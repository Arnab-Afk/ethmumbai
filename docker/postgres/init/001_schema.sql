CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  user_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connected_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_mode TEXT NOT NULL CHECK (domain_mode IN ('auto', 'custom')),
  custom_ens_name TEXT,
  parent_ens_name TEXT,
  ipns_key TEXT,
  env TEXT NOT NULL,
  webhook_secret TEXT,
  webhook_id BIGINT,
  connected_by TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner, repo, branch)
);

CREATE TABLE IF NOT EXISTS deploy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  cid TEXT,
  commit TEXT,
  pusher TEXT,
  domain TEXT,
  url TEXT,
  elapsed TEXT,
  error TEXT,
  record_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_custom_domains (
  ens_name TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  ipns_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verified_custom_domains (
  ens_name TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  ipns_key TEXT NOT NULL,
  verified_by TEXT NOT NULL,
  ens_to_ipns_status TEXT NOT NULL,
  ens_to_ipns_configured BOOLEAN NOT NULL DEFAULT FALSE,
  ens_to_ipns_tx_hash TEXT,
  verification_signature TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connected_repos_connected_by ON connected_repos (connected_by);
CREATE INDEX IF NOT EXISTS idx_deploy_history_repo_branch ON deploy_history (owner, repo, branch, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_custom_domains_verified_by ON verified_custom_domains (verified_by);
