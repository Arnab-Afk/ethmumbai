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

const router = express.Router();

// Simple in-memory concurrency counter
let activeJobs = 0;
const MAX_CONCURRENT = 3;

// ── POST /api/deploy ──────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { repoUrl, domain, env = "production", meta = "" } = req.body;

  // Validation
  if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });
  if (!domain)  return res.status(400).json({ error: "domain is required" });

  try { new URL(repoUrl); } catch {
    return res.status(400).json({ error: "Invalid repoUrl — must be a full URL" });
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({ error: "Too many concurrent deploys — try again shortly" });
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
    send("start", { repoUrl, domain, env, ts: new Date().toISOString() });

    const receipt = await runPipeline({ repoUrl, domain, env, meta }, log);

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
