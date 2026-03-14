/**
 * src/routes/github.js
 *
 * GitHub repo management + webhook receiver.
 * Auth is via JWT (from /api/auth/github flow).
 * All protected routes require:  Authorization: Bearer <token>
 *
 * Repo management:
 *   GET  /api/github/repos                       → list user GitHub repos
 *   GET  /api/github/repos/:owner/:repo/branches → list branches
 *   POST /api/github/connect                     → link repo+branch to domain, create webhook
 *   GET  /api/github/connected                   → connected repos for current user
 *   DEL  /api/github/connected/:owner/:repo/:branch → disconnect
 *
 * Webhook:
 *   POST /api/github/webhook                     → receive push events → auto-deploy
 *   GET  /api/github/webhook-url                 → return our webhook URL
 */

const express = require("express");
const gh      = require("../github");
const store   = require("../store");
const { requireAuth } = require("../auth");
const { runPipeline } = require("../pipeline");
const {
  DEFAULT_PARENT,
  buildAutoAssignedEnsName,
  isValidEnsName,
  normalizeEnsName,
} = require("../ens");

const router = express.Router();

// Helper — extract GitHub token from JWT payload
function githubToken(req) {
  const token = req.user?.githubToken;
  if (!token) throw { status: 403, message: "GitHub token not available — log in with GitHub, not Google" };
  return token;
}

// ── List repos ────────────────────────────────────────────────────────────────

router.get("/repos", requireAuth, async (req, res) => {
  try {
    const token  = githubToken(req);
    const repos  = await gh.listRepos(token);
    const linked = store.getReposForUser(req.user.login).map((r) => `${r.owner}/${r.repo}`);
    res.json({
      repos: repos.map((r) => ({ ...r, connected: linked.includes(r.fullName) })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── List branches ─────────────────────────────────────────────────────────────

router.get("/repos/:owner/:repo/branches", requireAuth, async (req, res) => {
  try {
    const token    = githubToken(req);
    const { owner, repo } = req.params;
    const branches = await gh.listBranches(token, owner, repo);
    res.json({ branches });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Connect a repo ────────────────────────────────────────────────────────────

router.post("/connect", requireAuth, async (req, res) => {
  const {
    repoFullName,
    branch = "main",
    domain,
    env = "production",
    domainMode = "auto",
    customEnsName,
  } = req.body;
  if (!repoFullName) return res.status(400).json({ error: "repoFullName required" });

  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) return res.status(400).json({ error: "Invalid repoFullName (use owner/repo)" });

  const mode = domainMode === "custom" ? "custom" : "auto";
  const resolvedDomain = mode === "custom"
    ? normalizeEnsName(customEnsName || domain)
    : normalizeEnsName(domain || buildAutoAssignedEnsName(DEFAULT_PARENT));

  if (!resolvedDomain) {
    return res.status(400).json({ error: "domain could not be resolved" });
  }
  if (!isValidEnsName(resolvedDomain)) {
    return res.status(400).json({ error: `Invalid ENS domain: ${resolvedDomain}` });
  }

  try {
    const token      = githubToken(req);
    const secret     = gh.makeWebhookSecret();
    const webhookUrl = `${process.env.BACKEND_URL || "http://localhost:3001"}/api/github/webhook`;

    let webhookId = null;
    try {
      webhookId = await gh.createWebhook(token, owner, repo, webhookUrl, secret);
    } catch (e) {
      console.warn("[connect] Webhook failed:", e.message);
    }

    const key = store.connectRepo({
      repoFullName, owner, repo, branch,
      domain: resolvedDomain,
      domainMode: mode,
      customEnsName: mode === "custom" ? resolvedDomain : null,
      parentEnsName: mode === "auto" ? DEFAULT_PARENT : null,
      env,
      webhookSecret: secret, webhookId,
      connectedBy: req.user.login,
    });

    res.json({
      ok: true, key, webhookId,
      domain: resolvedDomain,
      domainMode: mode,
      message: webhookId
        ? `Webhook created — pushes to ${branch} auto-deploy to ${resolvedDomain}`
        : `Repo saved — add webhook manually at ${webhookUrl}`,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── List connected repos ──────────────────────────────────────────────────────

router.get("/connected", requireAuth, (req, res) => {
  const repos = store.getReposForUser(req.user.login).map((r) => ({
    ...r,
    webhookSecret:  undefined,
    recentDeploys:  store.getDeployRecords(r.owner, r.repo, r.branch).slice(0, 5),
  }));
  res.json({ repos });
});

// ── Disconnect ────────────────────────────────────────────────────────────────

router.delete("/connected/:owner/:repo/:branch", requireAuth, async (req, res) => {
  const { owner, repo, branch } = req.params;
  const existing = store.getConnectedRepo(owner, repo, branch);

  if (!existing)                                    return res.status(404).json({ error: "Not connected" });
  if (existing.connectedBy !== req.user.login)      return res.status(403).json({ error: "Not your connection" });

  try {
    if (existing.webhookId) {
      const token = githubToken(req);
      await gh.deleteWebhook(token, owner, repo, existing.webhookId);
    }
  } catch { /* ignore webhook deletion errors */ }

  store.disconnectRepo(owner, repo, branch);
  res.json({ ok: true });
});

// ── Webhook URL helper ────────────────────────────────────────────────────────

router.get("/webhook-url", (_req, res) => {
  res.json({
    url: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/github/webhook`,
    hint: "Content-Type: application/json | Events: push only",
  });
});

// ── Webhook receiver ──────────────────────────────────────────────────────────
// Uses express.raw() — must come BEFORE global express.json()

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const event     = req.headers["x-github-event"];
    const sigHeader = req.headers["x-hub-signature-256"];
    const rawBody   = req.body;

    if (event !== "push") return res.status(200).json({ skipped: true, event });

    let payload;
    try { payload = JSON.parse(rawBody.toString()); }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }

    const pushedBranch = payload.ref?.replace("refs/heads/", "") || "";
    const owner  = payload.repository?.owner?.login;
    const repo   = payload.repository?.name;
    const cloneUrl = payload.repository?.clone_url;

    if (!owner || !repo) return res.status(400).json({ error: "Missing repo info" });

    const config = store.getConnectedRepo(owner, repo, pushedBranch);
    if (!config) return res.status(200).json({ skipped: true, reason: `${pushedBranch} not connected` });

    if (!gh.verifySignature(config.webhookSecret, rawBody, sigHeader)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Ack immediately — pipeline is async
    const commit = payload.after?.slice(0, 7) || "?";
    const pusher = payload.pusher?.name || "github";
    res.status(202).json({
      ok: true,
      message: `Deploy triggered: ${owner}/${repo}@${pushedBranch} (${commit}) → ${config.domain}`,
    });

    const log = (l) => console.log(`[webhook:${owner}/${repo}@${pushedBranch}] ${l}`);
    log(`Push by ${pusher} (${commit})`);

    runPipeline({
      repoUrl: cloneUrl,
      domain: config.domain,
      env: config.env,
      meta: `commit:${commit},by:${pusher}`,
      ens: {
        mode: config.domainMode || "custom",
        fullName: config.domain,
      },
    }, log)
      .then((r) => {
        log(`✅ CID: ${r.cid}`);
        store.addDeployRecord(owner, repo, pushedBranch, { cid: r.cid, commit, pusher, domain: config.domain, url: r.gateways.ipfs_io, elapsed: r.elapsed });
      })
      .catch((err) => {
        log(`❌ ${err.message}`);
        store.addDeployRecord(owner, repo, pushedBranch, { cid: null, commit, pusher, domain: config.domain, error: err.message });
      });
  }
);

module.exports = router;
