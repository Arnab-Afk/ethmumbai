/**
 * src/github.js
 * GitHub API helper — wraps Octokit for repo listing, webhook management, etc.
 */

const { Octokit } = require("@octokit/rest");
const crypto      = require("crypto");

/** Create an Octokit instance for a given access token */
function octokit(token) {
  return new Octokit({ auth: token });
}

/** List all repos the authenticated user has access to (up to 100) */
async function listRepos(token) {
  const ok = octokit(token);
  const repos = await ok.paginate(ok.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
    visibility: "all",
  });
  return repos.map((r) => ({
    id:            r.id,
    fullName:      r.full_name,
    name:          r.name,
    owner:         r.owner.login,
    private:       r.private,
    defaultBranch: r.default_branch,
    url:           r.html_url,
    updatedAt:     r.updated_at,
  }));
}

/** List branches for a repo */
async function listBranches(token, owner, repo) {
  const ok = octokit(token);
  const { data } = await ok.repos.listBranches({ owner, repo, per_page: 50 });
  return data.map((b) => b.name);
}

/** Get authenticated user info */
async function getUser(token) {
  const ok = octokit(token);
  const { data } = await ok.users.getAuthenticated();
  return { login: data.login, name: data.name, avatarUrl: data.avatar_url };
}

/** Generate a webhook secret */
function makeWebhookSecret() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Create a webhook on a repo that points to our backend.
 * Returns the webhook id.
 */
async function createWebhook(token, owner, repo, callbackUrl, secret) {
  const ok = octokit(token);
  const { data } = await ok.repos.createWebhook({
    owner, repo,
    config: { url: callbackUrl, content_type: "json", secret },
    events: ["push"],
    active: true,
  });
  return data.id;
}

/** Delete a webhook */
async function deleteWebhook(token, owner, repo, hookId) {
  const ok = octokit(token);
  await ok.repos.deleteWebhook({ owner, repo, hook_id: hookId }).catch(() => {});
}

/**
 * Verify GitHub webhook signature (HMAC-SHA256)
 * Returns true if valid.
 */
function verifySignature(secret, rawBody, sigHeader) {
  if (!sigHeader) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = {
  octokit, listRepos, listBranches, getUser,
  makeWebhookSecret, createWebhook, deleteWebhook, verifySignature,
};
