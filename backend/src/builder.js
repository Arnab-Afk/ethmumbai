/**
 * src/builder.js
 *
 * Framework detection + build pipeline
 *
 * Given a cloned repo directory:
 *   1. Detect framework (Next.js, Vite, CRA, plain HTML)
 *   2. Install deps
 *   3. Patch next.config for IPFS (assetPrefix + env) if Next.js
 *   4. Build → returns the output directory
 */

const fs        = require("fs");
const path      = require("path");
const { execSync, spawn } = require("child_process");
const fse       = require("fs-extra");

/** Detect Next.js / Vite / CRA / plain */
function detectFramework(repoDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoDir, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps["next"])         return "nextjs";
  if (deps["vite"])         return "vite";
  if (deps["react-scripts"]) return "cra";
  return "plain";
}

/** Output directory by framework */
function getOutDir(repoDir, framework) {
  switch (framework) {
    case "nextjs": return path.join(repoDir, "out");
    case "vite":   return path.join(repoDir, "dist");
    case "cra":    return path.join(repoDir, "build");
    default:       return repoDir; // serve as-is
  }
}

/** Run a shell command and stream output to log callback */
function run(cmd, cwd, log) {
  return new Promise((resolve, reject) => {
    log(`  $ ${cmd}`);
    const proc = spawn(cmd, { cwd, shell: true });
    proc.stdout.on("data", (d) => d.toString().trim().split("\n").forEach((l) => log(`    ${l}`)));
    proc.stderr.on("data", (d) => d.toString().trim().split("\n").forEach((l) => log(`    ${l}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}: ${cmd}`));
    });
  });
}

/**
 * Patch next.config.js/ts to add static export + assetPrefix.
 * Called TWICE: first without assetPrefix (to get CID), then with it.
 */
function patchNextConfig(repoDir, assetCid = "") {
  const base    = assetCid ? `https://ipfs.io/ipfs/${assetCid}` : "";
  const content = `
// Auto-patched by EverDeploy
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  ${base ? `assetPrefix: "${base}",` : ""}
  ${base ? `env: { NEXT_PUBLIC_IPFS_ASSET_BASE: "${base}" },` : ""}
};
module.exports = nextConfig;
`;

  // Remove existing config
  for (const f of ["next.config.js", "next.config.ts", "next.config.mjs"]) {
    const fp = path.join(repoDir, f);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  fs.writeFileSync(path.join(repoDir, "next.config.js"), content);
}

/**
 * Main build function.
 * Returns: { outDir, framework }
 *
 * assetCid: if provided, patches assetPrefix into Next.js config (second pass)
 */
async function buildRepo(repoDir, assetCid = "", log = console.log) {
  // Validate package.json exists
  if (!fs.existsSync(path.join(repoDir, "package.json"))) {
    // Plain HTML — no build needed
    return { outDir: repoDir, framework: "plain" };
  }

  const framework = detectFramework(repoDir);
  log(`  🔍 Detected framework: ${framework}`);

  // Install
  log("\n  📦 Installing dependencies...");
  await run("npm install --legacy-peer-deps", repoDir, log);

  if (framework === "nextjs") {
    patchNextConfig(repoDir, assetCid);
    log(`  ⚙️  next.config.js patched (assetCid=${assetCid || "none"})`);
  }

  // Build
  log("\n  🔨 Building...");
  const buildCmd = framework === "cra" ? "npm run build -- --legacy-peer-deps" : "npm run build";
  await run(buildCmd, repoDir, log);

  const outDir = getOutDir(repoDir, framework);
  if (!fs.existsSync(outDir)) {
    throw new Error(`Build output directory not found: ${outDir}`);
  }

  log(`  ✅ Build output: ${outDir}`);
  return { outDir, framework };
}

module.exports = { buildRepo, detectFramework, getOutDir, patchNextConfig };
