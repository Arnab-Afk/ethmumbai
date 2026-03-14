/**
 * src/routes/auth.js
 *
 * Unified OAuth — GitHub (with repo scope) + Google
 *
 * ── GitHub ────────────────────────────────────────────────────────────────────
 *   GET /api/auth/github           → redirect to GitHub OAuth
 *   GET /api/auth/github/callback  → exchange code → JWT → redirect frontend
 *
 * ── Google ────────────────────────────────────────────────────────────────────
 *   GET /api/auth/google           → redirect to Google OAuth
 *   GET /api/auth/google/callback  → exchange code → JWT → redirect frontend
 *
 * ── Common ────────────────────────────────────────────────────────────────────
 *   GET /api/auth/me               → { user } from JWT
 *   POST /api/auth/logout          → (stateless — just tell frontend to drop token)
 */

const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");

const { signToken, requireAuth } = require("../auth");

const router = express.Router();

// In-memory CSRF state store (state → expiry)
const pendingStates = new Map();

function makeState(provider) {
  const state = `${provider}:${crypto.randomBytes(16).toString("hex")}`;
  pendingStates.set(state, Date.now() + 10 * 60 * 1000); // 10-min TTL
  return state;
}

function consumeState(state) {
  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  return expiry && Date.now() < expiry;
}

function backendUrl(req) {
  return process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB OAUTH
// Scope includes `repo` so we can list repos and create webhooks.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/github", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
  }
  const state  = makeState("github");
  const params = new URLSearchParams({
    client_id:    process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${backendUrl(req)}/api/auth/github/callback`,
    scope:        "repo read:user user:email",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get("/github/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(`${frontendUrl()}/login?error=${error}`);

  if (!consumeState(state)) {
    return res.redirect(`${frontendUrl()}/login?error=invalid_state`);
  }

  try {
    // Exchange code → access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  `${backendUrl(req)}/api/auth/github/callback`,
      },
      { headers: { Accept: "application/json" } }
    );

    const { access_token, error: oauthErr } = tokenRes.data;
    if (oauthErr || !access_token) {
      return res.redirect(`${frontendUrl()}/login?error=${oauthErr || "no_token"}`);
    }

    // Get GitHub user
    const [userRes, emailsRes] = await Promise.all([
      axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${access_token}` },
      }).catch(() => ({ data: [] })),
    ]);

    const ghUser    = userRes.data;
    const primary   = emailsRes.data.find?.((e) => e.primary)?.email || ghUser.email;

    // Sign JWT — embed GitHub token so backend can call GitHub API on user's behalf
    const token = signToken({
      sub:         `github:${ghUser.id}`,
      provider:    "github",
      login:       ghUser.login,
      name:        ghUser.name || ghUser.login,
      email:       primary,
      avatar:      ghUser.avatar_url,
      githubToken: access_token,  // stored in JWT — needed for repo/webhook API calls
    });

    // Redirect to frontend with token
    res.redirect(`${frontendUrl()}/dashboard?token=${token}`);
  } catch (err) {
    console.error("[auth/github/callback]", err.message);
    res.redirect(`${frontendUrl()}/login?error=server_error`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────────────────────

router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
  }
  const state  = makeState("google");
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${backendUrl(req)}/api/auth/google/callback`,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "online",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(`${frontendUrl()}/login?error=${error}`);

  if (!consumeState(state)) {
    return res.redirect(`${frontendUrl()}/login?error=invalid_state`);
  }

  try {
    // Exchange code → tokens
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type:    "authorization_code",
      redirect_uri:  `${backendUrl(req)}/api/auth/google/callback`,
    });

    const { access_token } = tokenRes.data;

    // Get user info
    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const gUser = userRes.data;

    // Sign JWT
    const token = signToken({
      sub:      `google:${gUser.id}`,
      provider: "google",
      login:    gUser.email.split("@")[0],
      name:     gUser.name,
      email:    gUser.email,
      avatar:   gUser.picture,
      // No githubToken — Google users cannot manage GitHub repos
    });

    res.redirect(`${frontendUrl()}/dashboard?token=${token}`);
  } catch (err) {
    console.error("[auth/google/callback]", err.message);
    res.redirect(`${frontendUrl()}/login?error=server_error`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMON ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/auth/me — decode token and return user info (no sensitive fields)
router.get("/me", requireAuth, (req, res) => {
  const { sub, provider, login, name, email, avatar, iat, exp } = req.user;
  res.json({
    user: { sub, provider, login, name, email, avatar },
    tokenExpires: new Date(exp * 1000).toISOString(),
    canManageRepos: provider === "github", // only GitHub users have repo access
  });
});

// POST /api/auth/logout — stateless, just instruct client to drop token
router.post("/logout", (_req, res) => {
  res.json({ ok: true, message: "Delete your token on the client side" });
});

// GET /api/auth/providers — available login options
router.get("/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id:        "github",
        name:      "GitHub",
        url:       "/api/auth/github",
        available: !!process.env.GITHUB_CLIENT_ID,
        note:      "Full access — can connect repos and auto-deploy on push",
      },
      {
        id:        "google",
        name:      "Google",
        url:       "/api/auth/google",
        available: !!process.env.GOOGLE_CLIENT_ID,
        note:      "View deploys and trigger manual deploys only",
      },
    ],
  });
});

module.exports = router;
