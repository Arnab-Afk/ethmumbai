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
const fse    = require("fs-extra");
const simpleGit = require("simple-git");

const { buildRepo, detectFramework } = require("./builder");
const { uploadDir, warmGateways }    = require("./ipfs");
const { logDeploy, updateIPNS }      = require("./chain");

const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io";

async function runPipeline({ repoUrl, domain, env = "production", meta = "" }, log = console.log) {
  const startTime = Date.now();
  log("═══════════════════════════════════════════════════");
  log("  EverDeploy Pipeline");
  log("═══════════════════════════════════════════════════");
  log(`  Repo   : ${repoUrl}`);
  log(`  Domain : ${domain}`);
  log(`  Env    : ${env}`);

  // ── 1. Clone ──────────────────────────────────────────
  const tmpDir = await fse.mkdtemp(path.join(os.tmpdir(), "everdeploy-"));
  log(`\n📥 Cloning into ${tmpDir}...`);

  const git = simpleGit();
  await git.clone(repoUrl, tmpDir, ["--depth", "1"]);
  log("  ✅ Cloned");

  try {
    // Detect framework upfront
    const framework = detectFramework(tmpDir).catch?.() || (() => {
      try { return require("./builder").detectFramework(tmpDir); } catch { return "plain"; }
    })();

    // ── 2. First build (no assetPrefix) ───────────────
    log("\n🔨 Build pass 1 (get base CID)...");
    const { outDir } = await buildRepo(tmpDir, "", log);

    // ── 3. First IPFS upload ───────────────────────────
    log("\n📤 IPFS upload pass 1...");
    const baseCid = await uploadDir(outDir, `${domain}:pass1`, log);
    log(`  CID (pass 1): ${baseCid}`);

    let finalCid = baseCid;

    // ── 4. Second pass for Next.js (inject assetPrefix) ─
    const fw = require("./builder").detectFramework(tmpDir);
    if (fw === "nextjs") {
      log("\n🔨 Build pass 2 (inject assetPrefix)...");
      const { outDir: outDir2 } = await buildRepo(tmpDir, baseCid, log);

      log("\n📤 IPFS upload pass 2...");
      finalCid = await uploadDir(outDir2, `${domain}:pass2`, log);
      log(`  CID (final): ${finalCid}`);
    }

    // ── 5. On-chain logging ────────────────────────────
    log("\n⛓️  Logging to blockchain...");
    await logDeploy(domain, finalCid, env, meta, log);

    log("\n🔗 Updating IPNS on-chain...");
    await updateIPNS(domain, finalCid, log);

    // ── 6. Gateway warmup ──────────────────────────────
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
