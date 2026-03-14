/**
 * src/store.js
 * In-memory store for:
 *   - OAuth sessions (token ↔ user)
 *   - Connected repos (repoFullName+branch → domain config)
 *   - Deploy history per repo
 *
 * For production: replace with a DB (Postgres/Mongo/SQLite).
 */

/** Map<sessionId, { token, user, createdAt }> */
const sessions = new Map();

/** Map<repoKey, ConnectedRepo> where repoKey = `owner/repo:branch` */
const connectedRepos = new Map();

/** Map<repoKey, DeployRecord[]>  */
const deployHistory = new Map();

/** Map<ensName, PendingCustomDomainChallenge> */
const pendingCustomDomains = new Map();

/** Map<ensName, VerifiedCustomDomain> */
const verifiedCustomDomains = new Map();

// ── Sessions ──────────────────────────────────────────────────────────────────

function setSession(id, data) {
  sessions.set(id, { ...data, createdAt: Date.now() });
}

function getSession(id) {
  return sessions.get(id) || null;
}

function deleteSession(id) {
  sessions.delete(id);
}

// ── Connected Repos ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} ConnectedRepo
 * @property {string} repoFullName  e.g. "arnab/myproject"
 * @property {string} owner
 * @property {string} repo
 * @property {string} branch        e.g. "main"
 * @property {string} domain        IPFS/ENS domain to log to
 * @property {"auto"|"custom"} domainMode
 * @property {string|null} customEnsName
 * @property {string|null} parentEnsName
 * @property {string|null} ipnsKey
 * @property {string} env           production | staging | preview
 * @property {string} webhookSecret
 * @property {number} webhookId
 * @property {string} connectedBy   GitHub login
 * @property {number} connectedAt
 */

function repoKey(owner, repo, branch) {
  return `${owner}/${repo}:${branch}`;
}

function connectRepo(data) {
  const key = repoKey(data.owner, data.repo, data.branch);
  connectedRepos.set(key, { ...data, connectedAt: Date.now() });
  return key;
}

function getConnectedRepo(owner, repo, branch) {
  return connectedRepos.get(repoKey(owner, repo, branch)) || null;
}

function getConnectedRepoByKey(key) {
  return connectedRepos.get(key) || null;
}

function getReposForUser(login) {
  return [...connectedRepos.values()].filter((r) => r.connectedBy === login);
}

function getAllConnectedRepos() {
  return [...connectedRepos.values()];
}

function disconnectRepo(owner, repo, branch) {
  const key = repoKey(owner, repo, branch);
  const existing = connectedRepos.get(key);
  connectedRepos.delete(key);
  return existing;
}

// ── Deploy History ────────────────────────────────────────────────────────────

function addDeployRecord(owner, repo, branch, record) {
  const key = repoKey(owner, repo, branch);
  const list = deployHistory.get(key) || [];
  list.unshift({ ...record, ts: Date.now() }); // newest first
  deployHistory.set(key, list.slice(0, 20));   // keep last 20
}

function getDeployRecords(owner, repo, branch) {
  return deployHistory.get(repoKey(owner, repo, branch)) || [];
}

// ── Custom Domain Verification ───────────────────────────────────────────────

function setPendingCustomDomain(ensName, data) {
  pendingCustomDomains.set(ensName.toLowerCase(), { ...data, createdAt: Date.now() });
}

function getPendingCustomDomain(ensName) {
  return pendingCustomDomains.get((ensName || "").toLowerCase()) || null;
}

function deletePendingCustomDomain(ensName) {
  pendingCustomDomains.delete((ensName || "").toLowerCase());
}

function setVerifiedCustomDomain(ensName, data) {
  verifiedCustomDomains.set(ensName.toLowerCase(), {
    ...data,
    verifiedAt: Date.now(),
  });
}

function getVerifiedCustomDomain(ensName) {
  return verifiedCustomDomains.get((ensName || "").toLowerCase()) || null;
}

function getVerifiedCustomDomainsForUser(userSub) {
  return [...verifiedCustomDomains.entries()]
    .filter(([, d]) => d.verifiedBy === userSub)
    .map(([ensName, d]) => ({ ensName, ...d }));
}

module.exports = {
  setSession, getSession, deleteSession,
  connectRepo, getConnectedRepo, getConnectedRepoByKey,
  getReposForUser, getAllConnectedRepos, disconnectRepo,
  addDeployRecord, getDeployRecords, repoKey,
  setPendingCustomDomain, getPendingCustomDomain, deletePendingCustomDomain,
  setVerifiedCustomDomain, getVerifiedCustomDomain, getVerifiedCustomDomainsForUser,
};
