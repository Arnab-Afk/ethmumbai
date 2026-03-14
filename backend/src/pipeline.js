/**
 * src/pipeline.js
 *
 * The core EverDeploy pipeline:
 *   1. Clone repo
 *   2. Build (first pass — no assetPrefix yet)
 *   3. Upload to IPFS → get CID
 *   4. If Next.js: rebuild with assetPrefix = CID, re-upload → final CID
 *   5. Log deploy on-chain (DeployRegistry + IPNSRegistry)
 *   6. Warm public gateways
 *
 * All steps stream log lines via the `log` callback.
 * Returns a deploy receipt object.
 */

const path   = require("path");
const os     = require("os");
const fs     = require("fs");
const fse    = require("fs-extra");
const simpleGit = require("simple-git");

const { buildRepo, detectFramework } = require("./builder");
const { uploadDir, warmGateways }    = require("./ipfs");
const { logDeploy, updateIPNS }      = require("./chain");
const { upsertAutoSubnameContenthash } = require("./ens");

const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io";

/**
 * Parse a raw GitHub URL that may include /tree/<branch>/<subpath>.
 * Returns { cloneUrl, branch, subDir }.
 *
 * Examples:
 *   https://github.com/user/repo/tree/main/frontend  → clone repo, branch=main, subDir=frontend
 *   https://github.com/user/repo                     → clone repo, branch=null, subDir=""
 *   https://github.com/user/repo.git                 → clone repo, branch=null, subDir=""
 */
function parseRepoUrl(rawUrl) {
  const treeMatch = rawUrl.match(
    /^(https?:\/\/github\.com\/[^/]+\/[^/]+?)(?:\.git)?\/tree\/([^/]+)\/?(.*)$/
  );
  if (treeMatch) {
    return {
      cloneUrl: treeMatch[1] + ".git",
      branch:   treeMatch[2],
      subDir:   treeMatch[3] ? treeMatch[3].replace(/\/$/, "") : "",
    };
  }
  // Plain repo URL (with or without .git)
  return { cloneUrl: rawUrl, branch: null, subDir: "" };
}

async function runPipeline({ repoUrl, domain, env = "production", meta = "", ens = null }, log = console.log) {
  const startTime = Date.now();
  log("═══════════════════════════════════════════════════");
  log("  EverDeploy Pipeline");
  log("═══════════════════════════════════════════════════");
  log(`  Repo   : ${repoUrl}`);
  log(`  Domain : ${domain}`);
  log(`  Env    : ${env}`);

  // ── 1. Clone ──────────────────────────────────────────
  const { cloneUrl, branch, subDir } = parseRepoUrl(repoUrl);

  // Use a stable build directory under $HOME instead of /var/folders temp dir.
  // macOS temp dirs are symlinked (/var → /private/var) which causes Next.js
  // jest-worker / Turbopack workers to crash with path resolution errors.
  const buildBase = path.join(os.homedir(), ".everdeploy", "builds");
  await fse.ensureDir(buildBase);
  const tmpDir = await fse.mkdtemp(path.join(buildBase, "build-"));
  log(`\n📥 Cloning ${cloneUrl}${branch ? ` (branch: ${branch})` : ""}${subDir ? ` (subdir: ${subDir})` : ""}...`);

  const cloneArgs = ["--depth", "1"];
  if (branch) cloneArgs.push("--branch", branch);

  const git = simpleGit();
  await git.clone(cloneUrl, tmpDir, cloneArgs);
  log("  ✅ Cloned");

  // If the user pointed at a subdirectory, work inside it
  const buildDir = subDir ? path.join(tmpDir, subDir) : tmpDir;
  if (subDir) {
    if (!(await fse.pathExists(buildDir))) {
      throw new Error(`Subdirectory '${subDir}' not found in repository`);
    }
    log(`  📁 Using subdirectory: ${subDir}`);
  }

  try {
    // ── 2. First build (no assetPrefix) ───────────────
    log("\n🔨 Build pass 1 (get base CID)...");
    const { outDir } = await buildRepo(buildDir, "", log);

    // ── 3. First IPFS upload ───────────────────────────
    log("\n📤 IPFS upload pass 1...");
    const baseCid = await uploadDir(outDir, `${domain}:pass1`, log);
    log(`  CID (pass 1): ${baseCid}`);

    let finalCid = baseCid;

    // ── 4. Second pass for Next.js (inject assetPrefix) ─
    const fw = require("./builder").detectFramework(buildDir);
    if (fw === "nextjs") {
      log("\n🔨 Build pass 2 (inject assetPrefix)...");
      const { outDir: outDir2 } = await buildRepo(buildDir, baseCid, log);

      log("\n📤 IPFS upload pass 2...");
      finalCid = await uploadDir(outDir2, `${domain}:pass2`, log);
      log(`  CID (final): ${finalCid}`);
    }

    // ── 5. ENS update ──────────────────────────────────
    const ensConfig = ens || { mode: "custom", fullName: domain };
    let ensResult = {
      mode: ensConfig.mode || "custom",
      name: ensConfig.fullName || domain,
      contenthash: ensConfig.mode === "auto" ? `ipfs://${finalCid}` : (ensConfig.ipnsKey ? `ipns://${ensConfig.ipnsKey}` : null),
      managedBy: ensConfig.mode === "auto" ? "server" : "wallet",
      status: ensConfig.mode === "auto" ? "updated" : "pending-user-transaction",
    };

    if (ensConfig.mode === "auto") {
      log("\n🪪 Updating ENS (Namespace Offchain)...");
      const ns = await upsertAutoSubnameContenthash(ensConfig.fullName || domain, finalCid, log);
      ensResult = {
        mode: "auto",
        name: ns.fullName,
        contenthash: ns.contenthash,
        managedBy: "server",
        status: ns.action,
      };
    } else {
      log("\n🪪 Custom ENS mode detected (wallet tx required client-side).");
    }

    // ── 6. On-chain logging ────────────────────────────
    log("\n⛓️  Logging to blockchain...");
    await logDeploy(domain, finalCid, env, meta, log);

    log("\n🔗 Updating IPNS on-chain...");
    await updateIPNS(domain, finalCid, { ipnsKey: ensConfig.ipnsKey || null }, log);

    // ── 7. Gateway warmup ──────────────────────────────
    log("\n🔥 Warming gateways...");
    await warmGateways(finalCid, log);

    // ── Receipt ────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const receipt = {
      cid: finalCid,
      domain,
      env,
      framework: fw,
      elapsed: `${elapsed}s`,
      timestamp: new Date().toISOString(),
      gateways: {
        ipfs_io:  `${IPFS_GATEWAY}/ipfs/${finalCid}/`,
        dweb:     `https://${finalCid}.ipfs.dweb.link/`,
        w3s:      `https://${finalCid}.ipfs.w3s.link/`,
      },
      ens: ensResult,
      ipns: {
        key: ensConfig.ipnsKey || null,
      },
      contracts: {
        DeployRegistry: process.env.REGISTRY_CONTRACT,
        IPNSRegistry:   process.env.IPNS_REGISTRY_CONTRACT,
      },
    };

    log("\n═══════════════════════════════════════════════════");
    log("  🚀 Pipeline complete!");
    log(`  CID      : ${finalCid}`);
    log(`  URL      : ${receipt.gateways.ipfs_io}`);
    log(`  Elapsed  : ${elapsed}s`);
    log("═══════════════════════════════════════════════════");

    return receipt;
  } finally {
    // Always clean up temp dir
    await fse.remove(tmpDir).catch(() => {});
  }
}

module.exports = { runPipeline };
