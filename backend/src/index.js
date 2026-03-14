/**
 * src/index.js — EverDeploy backend server
 */

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const deployRouter = require("./routes/deploy");
const sitesRouter  = require("./routes/sites");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/", (_req, res) => {
  res.json({
    service: "EverDeploy Backend",
    version: "1.0.0",
    status:  "ok",
    endpoints: {
      "POST /api/deploy":           "Trigger a full deploy (SSE stream)",
      "GET  /api/deploy/status":    "Active deploy count",
      "GET  /api/sites":            "List all deployed domains",
      "GET  /api/sites/:domain":    "Deploy history for a domain",
      "GET  /api/sites/:domain/ipns": "IPNS entry for a domain",
    },
  });
});

app.use("/api/deploy", deployRouter);
app.use("/api/sites",  sitesRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 EverDeploy backend running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/deploy`);
  console.log(`  GET  http://localhost:${PORT}/api/sites`);
  console.log(`  GET  http://localhost:${PORT}/api/sites/:domain\n`);
});
