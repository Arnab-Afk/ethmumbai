/**
 * src/routes/deploy.js
 *
 * POST /api/deploy
 *   Body: { repoUrl, domain, env?, meta? }
 *   Streams Server-Sent Events (SSE) with log lines + final JSON receipt.
 *
 * GET /api/deploy/status
 *   Returns { active: number } — how many deploys are running.
 */

const express      = require("express");
const { runPipeline } = require("../pipeline");
const { buildAutoAssignedEnsName, DEFAULT_PARENT } = require("../ens");
const store = require("../store");

const router = express.Router();

// Simple in-memory concurrency counter
let activeJobs = 0;
const MAX_CONCURRENT = 3;

function parseGitHubRepoInfo(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "github.com") return null;

    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    let branch = null;

    if (parts[2] === "tree" && parts[3]) {
      branch = parts[3];
    }

    return { owner, repo, branch };
  } catch {
    return null;
  }
}

// ── POST /api/deploy ──────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const {
    repoUrl,
    domain: rawDomain,
    env = "production",
    meta = "",
    domainMode = "custom",
    ipnsKey = null,
  } = req.body;

  const isAutoMode = domainMode === "auto";
  const domain = isAutoMode
    ? (rawDomain && rawDomain !== "auto" ? rawDomain : buildAutoAssignedEnsName(DEFAULT_PARENT))
    : rawDomain;

  // Validation
  if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });
  if (!domain)  return res.status(400).json({ error: "domain is required" });
  if (domainMode === "custom" && !ipnsKey) {
    return res.status(400).json({ error: "ipnsKey is required for custom domains. Complete custom domain verification first." });
  }

  try { new URL(repoUrl); } catch {
    return res.status(400).json({ error: "Invalid repoUrl — must be a full URL" });
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({ error: "Too many concurrent deploys — try again shortly" });
  }

  let githubToken = req.user?.githubToken || null;
  const ghInfo = parseGitHubRepoInfo(repoUrl);

  if (!githubToken && ghInfo) {
    if (ghInfo.branch) {
      const existing = store.getConnectedRepo(ghInfo.owner, ghInfo.repo, ghInfo.branch);
      if (existing?.connectedBy === req.user?.login && existing?.githubToken) {
        githubToken = existing.githubToken;
      }
    }

    if (!githubToken) {
      const fallback = store
        .getReposForUser(req.user?.login)
        .find((r) => r.owner === ghInfo.owner && r.repo === ghInfo.repo && r.githubToken);
      if (fallback?.githubToken) {
        githubToken = fallback.githubToken;
      }
    }
  }

  activeJobs++;

  // ── SSE headers ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat every 15s to keep connection alive during long builds
  const heartbeat = setInterval(() => send("heartbeat", { ts: Date.now() }), 15000);

  const log = (line) => send("log", { line });

  try {
    send("start", { repoUrl, domain, env, domainMode, ts: new Date().toISOString() });

    const receipt = await runPipeline({
      repoUrl,
      domain,
      env,
      meta,
      githubToken,
      ens: {
        mode: domainMode === "auto" ? "auto" : "custom",
        fullName: domain,
        ipnsKey,
      },
    }, log);

    send("done", receipt);
  } catch (err) {
    console.error("[deploy] Pipeline error:", err.message);
    send("error", { message: err.message });
  } finally {
    clearInterval(heartbeat);
    activeJobs--;
    res.end();
  }
});

// ── GET /api/deploy/status ────────────────────────────────────────────────────

router.get("/status", (_req, res) => {
  res.json({ active: activeJobs, max: MAX_CONCURRENT });
});

module.exports = router;
