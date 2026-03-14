/**
 * src/index.js — EverDeploy backend server
 */

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const authRouter   = require("./routes/auth");
const deployRouter = require("./routes/deploy");
const sitesRouter  = require("./routes/sites");
const githubRouter = require("./routes/github");
const domainsRouter = require("./routes/domains");
const { requireAuth } = require("./auth");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(","),
  credentials: true,
}));
app.use(morgan("dev"));

// Raw body for GitHub webhook signature verification (must come before json parser)
app.use("/api/github/webhook", express.raw({ type: "application/json" }));
// JSON for everything else
app.use(express.json());

// ── Public routes (no auth) ───────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    service: "EverDeploy API",
    version: "1.0.0",
    docs: {
      auth: {
        "GET /api/auth/providers":       "List available OAuth providers",
        "GET /api/auth/github":          "Login with GitHub (repo scope)",
        "GET /api/auth/github/callback": "GitHub OAuth callback",
        "GET /api/auth/google":          "Login with Google",
        "GET /api/auth/google/callback": "Google OAuth callback",
        "GET /api/auth/me":              "Current user (requires token)",
        "POST /api/auth/logout":         "Logout",
      },
      deploy: {
        "POST /api/deploy":        "Trigger deploy from repo (SSE stream) 🔒",
        "GET /api/deploy/status":  "Active deploy count",
      },
      sites: {
        "GET /api/sites":               "All deployed domains",
        "GET /api/sites/:domain":       "Deploy history",
        "GET /api/sites/:domain/ipns":  "IPNS entry",
      },
      github: {
        "GET  /api/github/repos":               "List your GitHub repos 🔒",
        "GET  /api/github/repos/:o/:r/branches":"List branches 🔒",
        "POST /api/github/connect":             "Link repo → domain (creates webhook) 🔒",
        "GET  /api/github/connected":           "Your connected repos 🔒",
        "DEL  /api/github/connected/:o/:r/:b":  "Disconnect repo 🔒",
        "POST /api/github/webhook":             "GitHub push webhook receiver",
      },
      domains: {
        "POST /api/domains/custom/init":        "Start custom ENS ownership verification 🔒",
        "POST /api/domains/custom/verify":      "Verify signature for custom ENS ownership 🔒",
        "POST /api/domains/custom/confirm-link": "Confirm one-time ENS->IPNS tx hash 🔒",
        "GET  /api/domains/custom/:ensName":    "Get custom ENS verification status 🔒",
        "GET  /api/domains/custom":             "List your verified custom ENS names 🔒",
      },
    },
    note: "🔒 = requires Authorization: Bearer <token>",
  });
});

// Auth routes — public (they create tokens)
app.use("/api/auth", authRouter);

// Sites — public read
app.use("/api/sites", sitesRouter);

// Deploy — requires auth
app.use("/api/deploy", requireAuth, deployRouter);

// GitHub — mix of protected + webhook (webhook self-validates via HMAC)
app.use("/api/github", githubRouter);

// Custom ENS domain verification flow
app.use("/api/domains", domainsRouter);

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err.message || err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 EverDeploy API   → http://localhost:${PORT}`);
  console.log(`\n  🔑 Auth`);
  console.log(`     GitHub  → http://localhost:${PORT}/api/auth/github`);
  console.log(`     Google  → http://localhost:${PORT}/api/auth/google`);
  console.log(`     Me      → http://localhost:${PORT}/api/auth/me`);
  console.log(`\n  🚢 Deploy → POST http://localhost:${PORT}/api/deploy`);
  console.log(`  🌍 Sites  → GET  http://localhost:${PORT}/api/sites\n`);

  const missing = [
    !process.env.GITHUB_CLIENT_ID     && "GITHUB_CLIENT_ID",
    !process.env.GITHUB_CLIENT_SECRET && "GITHUB_CLIENT_SECRET",
    !process.env.GOOGLE_CLIENT_ID     && "GOOGLE_CLIENT_ID",
    !process.env.GOOGLE_CLIENT_SECRET && "GOOGLE_CLIENT_SECRET",
    !process.env.JWT_SECRET           && "JWT_SECRET (using random — set for production!)",
  ].filter(Boolean);

  if (missing.length) {
    console.warn("⚠️  Missing env vars:", missing.join(", "));
  }
});
