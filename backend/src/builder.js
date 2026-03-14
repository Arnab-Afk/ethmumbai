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
function run(cmd, cwd, log, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    log(`  $ ${cmd}`);
    const proc = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...extraEnv } });
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
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { cpus: 1, workerThreads: false },
  ${base ? `assetPrefix: "${base}",` : ""}
  ${base ? `env: { NEXT_PUBLIC_IPFS_ASSET_BASE: "${base}" },` : ""}
};
module.exports = nextConfig;
`;

  // Remove ALL existing config files
  for (const f of ["next.config.js", "next.config.ts", "next.config.mjs"]) {
    const fp = path.join(repoDir, f);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  fs.writeFileSync(path.join(repoDir, "next.config.js"), content);

  // Remove dynamic [param] route dirs — Turbopack can't handle them
  // with output:"export" even when generateStaticParams is present
  const removed = removeDynamicRoutes(repoDir);
  if (removed && removed.length) {
    // These are client-side routes; they still work via SPA navigation
  }
}

/**
 * Remove dynamic route directories (containing [param]) that lack
 * generateStaticParams — Turbopack in Next.js 16 fails to detect
 * generateStaticParams even when present in wrapper files.
 * Since these are client-side routes that resolve at runtime anyway,
 * removing them from the static export is safe.
 */
function removeDynamicRoutes(repoDir) {
  const appDir = path.join(repoDir, "app");
  if (!fs.existsSync(appDir)) return;

  const removed = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[") && entry.name.endsWith("]")) {
          fse.removeSync(full);
          removed.push(full.replace(repoDir + "/", ""));
        } else {
          walk(full);
        }
      }
    }
  })(appDir);
  return removed;
}

/**
 * Patch package.json BEFORE npm install:
 * - Strip any --turbopack flag from the build script
 */
function patchPackageJsonBeforeInstall(repoDir, log) {
  const pkgPath = path.join(repoDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const nextVer = (pkg.dependencies && pkg.dependencies.next) || "";
  const major = parseInt(nextVer.replace(/[^\d]/, ""), 10);

  // Next.js 16+ uses Turbopack by default; its static-generation worker
  // crashes with "Unexpected response from worker: undefined" even with
  // NEXT_PRIVATE_WORKER_THREADS=0. Pin to 15.x for reliable webpack builds.
  if (major >= 16 && pkg.dependencies && pkg.dependencies.next) {
    pkg.dependencies.next = "^15.3.3";
    // Delete lockfile so npm actually installs the pinned version
    const lockPath = path.join(repoDir, "package-lock.json");
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    log && log("  ⬇️  Pinning Next.js to 15.x (v16 Turbopack static-gen worker crash)");
  }

  // Strip --turbopack from build script
  if (pkg.scripts && pkg.scripts.build) {
    pkg.scripts.build = pkg.scripts.build.replace(/--turbopack/g, "").trim();
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
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

  // For Next.js: patch package.json BEFORE install so npm installs the right version
  if (framework === "nextjs") {
    patchPackageJsonBeforeInstall(repoDir, log);
    log(`  ⚙️  package.json patched`);
  }

  // Install
  log("\n  📦 Installing dependencies...");
  await run("npm install --legacy-peer-deps", repoDir, log);

  if (framework === "nextjs") {
    patchNextConfig(repoDir, assetCid);
    log(`  ⚙️  next.config.js patched (assetCid=${assetCid || "none"})`);
  }

  // Build
  log("\n  🔨 Building...");
  let buildCmd;
  if (framework === "cra") {
    buildCmd = "npm run build -- --legacy-peer-deps";
  } else if (framework === "nextjs") {
    // Call next build directly via npx, bypassing whatever's in package.json.
    // Use --experimental-build-mode=compile to avoid the static generation
    // worker that crashes with "Unexpected response from worker: undefined".
    // Then run the export separately.
    buildCmd = "npx next build";
  } else {
    buildCmd = "npm run build";
  }

  await run(buildCmd, repoDir, log, {
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PRIVATE_WORKER_THREADS: "0",
    NEXT_PRIVATE_STANDALONE: "0",
    NODE_OPTIONS: "--max-old-space-size=4096",
  });

  const outDir = getOutDir(repoDir, framework);
  if (!fs.existsSync(outDir)) {
    throw new Error(`Build output directory not found: ${outDir}`);
  }

  log(`  ✅ Build output: ${outDir}`);
  return { outDir, framework };
}

module.exports = { buildRepo, detectFramework, getOutDir, patchNextConfig };
