const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("d3ploy_token");
}

export function saveToken(token: string) {
  localStorage.setItem("d3ploy_token", token);
}

export function clearToken() {
  localStorage.removeItem("d3ploy_token");
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  sub: string;
  provider: string;
  login: string;
  name: string;
  email: string;
  avatar: string;
  iat: number;
  exp: number;
}

export async function getMe(): Promise<{ user: User }> {
  return apiFetch("/api/auth/me");
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  clearToken();
}

export function getLoginUrl(): string {
  return `${API_BASE}/api/auth/github`;
}

// ── Sites ─────────────────────────────────────────────────────────────────────

export interface Deploy {
  cid: string;
  deployer: string;
  env: string;
  meta: string;
  timestamp: number;
  url: string;
}

export interface SiteDetail {
  domain: string;
  count: number;
  latest: Deploy | null;
  history: Deploy[];
}

export interface IPNSEntry {
  domain: string;
  ipnsKey: string;
  latestCid: string;
  latestSeq: number;
  registeredAt: number;
  updatedAt: number;
  active: boolean;
  gateways: string[];
  url: string;
}

export async function getSites(): Promise<{ domains: string[] }> {
  return apiFetch("/api/sites");
}

export async function getSite(domain: string): Promise<SiteDetail> {
  return apiFetch(`/api/sites/${encodeURIComponent(domain)}`);
}

export async function getSiteIPNS(domain: string): Promise<IPNSEntry> {
  return apiFetch(`/api/sites/${encodeURIComponent(domain)}/ipns`);
}

// ── Deploy ────────────────────────────────────────────────────────────────────

export interface DeployStatus {
  active: number;
  max: number;
}

export async function getDeployStatus(): Promise<DeployStatus> {
  return apiFetch("/api/deploy/status");
}

export interface DeployReceipt {
  domain: string;
  cid: string;
  ipnsKey?: string;
  txHash?: string;
  gatewayUrl?: string;
  [key: string]: unknown;
}

/** Start a deploy, streaming SSE log lines back to the caller.
 *  Returns an abort function to cancel the deploy stream. */
export function deployStream(
  data: { repoUrl: string; domain: string; env?: string; meta?: string; domainMode?: "auto" | "custom" },
  onLog: (line: string) => void,
  onDone: (receipt: DeployReceipt) => void,
  onError: (message: string) => void
): () => void {
  const token = getToken();
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Deploy failed" }));
        onError(err.error || "Deploy failed");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let event = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!event || !dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (event === "log") onLog(parsed.line);
            else if (event === "done") onDone(parsed as DeployReceipt);
            else if (event === "error") onError(parsed.message);
          } catch {
            // ignore malformed SSE data
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        onError(err.message);
      }
    }
  })();

  return () => controller.abort();
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export interface Repo {
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  connected: boolean;
}

export interface ConnectedRepo {
  repoFullName: string;
  owner: string;
  repo: string;
  branch: string;
  domain: string;
  domainMode: "auto" | "custom";
  customEnsName?: string | null;
  parentEnsName?: string | null;
  ipnsKey?: string | null;
  env: string;
  webhookId: number | null;
  connectedBy: string;
  recentDeploys: Deploy[];
}

export async function getRepos(): Promise<{ repos: Repo[] }> {
  return apiFetch("/api/github/repos");
}

export async function getBranches(
  owner: string,
  repo: string
): Promise<{ branches: string[] }> {
  return apiFetch(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`);
}

export async function connectRepo(data: {
  repoFullName: string;
  branch: string;
  domain?: string;
  domainMode?: "auto" | "custom";
  customEnsName?: string;
  env: string;
}): Promise<{ ok: boolean; key: string; webhookId: number | null; message: string; domain: string; domainMode: "auto" | "custom" }> {
  return apiFetch("/api/github/connect", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Custom ENS domains ───────────────────────────────────────────────────────

export interface CustomDomainInitResponse {
  ensName: string;
  walletAddress: string;
  ipnsKey: string;
  nonce: string;
  message: string;
  note: string;
}

export interface CustomDomainVerifyResponse {
  ok: boolean;
  ensName: string;
  walletAddress: string;
  ipnsKey: string;
  ensToIpnsStatus: string;
  ensToIpnsConfigured: boolean;
  ensToIpnsTxHash?: string;
  note: string;
}

export async function initCustomDomainVerification(data: {
  ensName: string;
  walletAddress: string;
}): Promise<CustomDomainInitResponse> {
  return apiFetch("/api/domains/custom/init", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyCustomDomainSignature(data: {
  ensName: string;
  walletAddress: string;
  signature: string;
}): Promise<CustomDomainVerifyResponse> {
  return apiFetch("/api/domains/custom/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function confirmCustomDomainEnsLink(data: {
  ensName: string;
  txHash: string;
}): Promise<{ ok: boolean; ensName: string; ensToIpnsStatus: string; ensToIpnsConfigured: boolean; ensToIpnsTxHash: string }> {
  return apiFetch("/api/domains/custom/confirm-link", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getConnectedRepos(): Promise<{ repos: ConnectedRepo[] }> {
  return apiFetch("/api/github/connected");
}

export async function disconnectRepo(
  owner: string,
  repo: string,
  branch: string
) {
  return apiFetch(
    `/api/github/connected/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}`,
    { method: "DELETE" }
  );
}
