"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken, getConnectedRepos, ConnectedRepo, DeployReceipt, getRepos, Repo, getBranches } from "@/lib/api";
import Navbar from "@/components/navbar";

type DeployState = "idle" | "deploying" | "done" | "error";
const FOLDER_BY_REPO_KEY = "d3ploy_folder_by_repo";
const DEMO_RECEIPT_KEY = "d3ploy_demo_last_receipt";
const DEMO_DOMAIN = "d3ploy.pushx.eth";

function detectFrameworkHint(folderPath: string, repoUrl: string) {
  const hintSource = `${folderPath} ${repoUrl}`.toLowerCase();
  if (hintSource.includes("next")) return "Next.js (pre-check)";
  if (hintSource.includes("vite")) return "Vite (pre-check)";
  if (hintSource.includes("react-scripts") || hintSource.includes("cra")) return "Create React App (pre-check)";
  return "Auto-detect from package.json at build time";
}

function createFakeCid() {
  const rand = Math.random().toString(36).slice(2, 18);
  const stamp = Date.now().toString(36);
  return `bafybeig${rand}${stamp}`.slice(0, 46);
}

function runDemoDeploy(
  data: { repoUrl: string; env: "production" | "preview"; meta: string },
  onLog: (line: string) => void,
  onDone: (receipt: DeployReceipt) => void
): () => void {
  const cid = createFakeCid();
  const ipnsKey = `k51qzi5uqu5d${Math.random().toString(36).slice(2, 26)}`;
  const steps = [
    `Cloning ${data.repoUrl}`,
    "Installing dependencies with cached pnpm store",
    "Running framework build command",
    "Uploading static artifacts to IPFS",
    `Pinned CID: ${cid}`,
    "Publishing updated IPNS record",
    `Resolving ENS contenthash for ${DEMO_DOMAIN}`,
    "Deployment finished successfully",
  ];

  const timers: number[] = [];
  steps.forEach((line, idx) => {
    const timer = window.setTimeout(() => onLog(line), 500 + idx * 7400);
    timers.push(timer);
  });

  const doneTimer = window.setTimeout(() => {
    const receipt: DeployReceipt = {
      domain: DEMO_DOMAIN,
      cid,
      txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 66),
      gatewayUrl: `https://ipfs.io/ipfs/${cid}`,
      ens: {
        mode: "custom",
        name: DEMO_DOMAIN,
        managedBy: "server",
        status: "updated",
      },
      ipns: {
        key: ipnsKey,
      },
    };

    try {
      localStorage.setItem(
        DEMO_RECEIPT_KEY,
        JSON.stringify({
          ...receipt,
          env: data.env,
          meta: data.meta,
          timestamp: Math.floor(Date.now() / 1000),
          deployer: "0x9A67D0fFe7B1C67f4b4E51e5E45E38f8dA6f8f25",
        })
      );
    } catch {
      // Ignore storage failures in private mode.
    }

    onDone(receipt);
  }, 500 + steps.length * 7400 + 300);
  timers.push(doneTimer);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}

export default function DeployPage() {
  const router = useRouter();

  const [repoUrl, setRepoUrl] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branch, setBranch] = useState("main");
  const [folderPath, setFolderPath] = useState("");
  const [autoConnect, setAutoConnect] = useState(true);
  const [domain, setDomain] = useState(DEMO_DOMAIN);
  const [domainMode, setDomainMode] = useState<"auto" | "custom">("auto");
  const [ipnsKey, setIpnsKey] = useState("");
  const [env, setEnv] = useState<"production" | "preview">("production");
  const [meta, setMeta] = useState("");
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");

  const [status, setStatus] = useState<DeployState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<DeployReceipt | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Auth guard — redirect to login if no token (backend requires auth for /api/deploy)
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    getConnectedRepos()
      .then((res) => setConnectedRepos(res.repos))
      .catch(() => setConnectedRepos([]));
  }, [router]);

  useEffect(() => {
    async function loadRepos() {
      try {
        setLoadingRepos(true);
        setReposError(null);
        const res = await getRepos();
        setRepos(res.repos);
      } catch (err: unknown) {
        const e = err as Error;
        if (e.message.includes("401") || e.message.includes("Authentication")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setReposError(e.message);
      } finally {
        setLoadingRepos(false);
      }
    }

    if (getToken()) loadRepos();
  }, [router]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function buildRepoTreeUrl(repoFullName: string, selectedBranch: string, folder: string) {
    const cleanBranch = (selectedBranch || "").trim();
    const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");

    if (!cleanBranch) return `https://github.com/${repoFullName}`;
    if (!cleanFolder) return `https://github.com/${repoFullName}/tree/${cleanBranch}`;
    return `https://github.com/${repoFullName}/tree/${cleanBranch}/${cleanFolder}`;
  }

  useEffect(() => {
    if (!selectedRepo) {
      setBranches([]);
      setBranch("main");
      setFolderPath("");
      return;
    }

    const picked = repos.find((r) => r.fullName === selectedRepo);
    const fallbackBranch = picked?.defaultBranch || "main";
    setBranch(fallbackBranch);

    async function loadBranches() {
      try {
        setLoadingBranches(true);
        const [owner, repoName] = selectedRepo.split("/");
        const res = await getBranches(owner, repoName);
        setBranches(res.branches);
        if (res.branches.length > 0 && !res.branches.includes(fallbackBranch)) {
          setBranch(res.branches[0]);
        }
      } catch {
        setBranches([fallbackBranch]);
      } finally {
        setLoadingBranches(false);
      }
    }

    loadBranches();
  }, [selectedRepo, repos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedRepo) return;

    try {
      const raw = localStorage.getItem(FOLDER_BY_REPO_KEY);
      const mapping = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      setFolderPath(mapping[selectedRepo] || "");
    } catch {
      setFolderPath("");
    }
  }, [selectedRepo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedRepo) return;

    try {
      const raw = localStorage.getItem(FOLDER_BY_REPO_KEY);
      const mapping = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      mapping[selectedRepo] = folderPath;
      localStorage.setItem(FOLDER_BY_REPO_KEY, JSON.stringify(mapping));
    } catch {
      // no-op when storage is unavailable
    }
  }, [selectedRepo, folderPath]);

  useEffect(() => {
    if (!selectedRepo) return;
    setRepoUrl(buildRepoTreeUrl(selectedRepo, branch, folderPath));
  }, [selectedRepo, branch, folderPath]);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    if (domainMode === "custom" && !ipnsKey.trim()) {
      setErrMsg("ipnsKey is required for custom domains. Complete custom domain setup first.");
      return;
    }

    setStatus("deploying");
    setLogs([]);
    setReceipt(null);
    setErrMsg(null);

    abortRef.current = runDemoDeploy(
      {
        repoUrl: repoUrl.trim(),
        env,
        meta: meta.trim(),
      },
      (line) => setLogs((prev) => [...prev, line]),
      (r) => {
        setReceipt(r);
        setStatus("done");
      }
    );
  }

  function handleCancel() {
    abortRef.current?.();
    setStatus("idle");
  }

  function handleReset() {
    abortRef.current?.();
    setStatus("idle");
    setLogs([]);
    setReceipt(null);
    setErrMsg(null);
  }

  function handleSelectConnection(value: string) {
    setSelectedConnection(value);
    if (!value) return;

    const [repoFullName, branch] = value.split("::");
    const match = connectedRepos.find((r) => r.repoFullName === repoFullName && r.branch === branch);
    if (!match) return;

    setRepoUrl(`https://github.com/${match.repoFullName}/tree/${match.branch}`);
    setDomain(match.domain);
    setDomainMode(match.domainMode);
    setIpnsKey(match.ipnsKey || "");
    if (match.env === "production" || match.env === "preview") {
      setEnv(match.env);
    }
  }

  const isDeploying = status === "deploying";

  return (
    <div className="min-h-screen bg-tg-black text-white font-sans antialiased p-6 md:p-12">
      <main className="max-w-7xl mx-auto space-y-6">
        <Navbar />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Header */}
          <div className="md:col-span-12 flex items-center justify-between">
            <div>
              <h1 className="font-display text-4xl font-extrabold">New Deployment</h1>
              <p className="text-tg-muted mt-1 text-sm">Deploy any Git repo to IPFS in seconds.</p>
            </div>
            <Link href="/dashboard" className="text-tg-muted text-sm hover:text-white transition-colors font-medium">
              ← Dashboard
            </Link>
          </div>

          {/* Form Card */}
          <div className="md:col-span-5 rounded-card bg-tg-gray border border-white/5 p-8">
            <h2 className="font-display text-xl font-bold mb-6">Configuration</h2>
            <div className="mb-5 rounded-2xl border border-tg-lime/30 bg-tg-lime/10 px-4 py-3 text-xs text-tg-lime">
              Pitch-safe deploy mode is enabled. This simulates a full successful pipeline and always deploys to {DEMO_DOMAIN}.
            </div>

            <form onSubmit={handleDeploy} className="space-y-5">
              {/* Connected config */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Connected Project <span className="text-white/30">(optional)</span>
                </label>
                <select
                  value={selectedConnection}
                  onChange={(e) => handleSelectConnection(e.target.value)}
                  disabled={isDeploying}
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50 appearance-none"
                >
                  <option value="">Manual input</option>
                  {connectedRepos.map((r) => (
                    <option key={`${r.owner}/${r.repo}/${r.branch}`} value={`${r.repoFullName}::${r.branch}`}>
                      {r.repoFullName} ({r.branch}) {"->"} {r.domain}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repo URL */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Select GitHub Repo
                </label>
                <select
                  value={selectedRepo}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedRepo(next);
                    setSelectedConnection("");
                    setFolderPath("");
                    const picked = repos.find((r) => r.fullName === next);
                    const defaultBranch = picked?.defaultBranch || "main";
                    setBranch(defaultBranch);
                    if (next) {
                      setRepoUrl(buildRepoTreeUrl(next, defaultBranch, ""));
                    }
                  }}
                  disabled={isDeploying || loadingRepos || repos.length === 0}
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50"
                >
                  <option value="">{loadingRepos ? "Loading repositories..." : "Select a repository (optional)"}</option>
                  {repos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
                {reposError && (
                  <p className="text-xs text-red-400">
                    Could not load repos: {reposError}
                  </p>
                )}
              </div>

              {selectedRepo && (
                <>
                  <div className="px-4 py-3 rounded-2xl bg-tg-black border border-white/10 text-xs text-tg-muted space-y-1">
                    <p>
                      Target: <span className="font-mono text-white">{selectedRepo}</span>
                      <span className="text-white/30"> @ </span>
                      <span className="font-mono text-white">{branch || "main"}</span>
                      {folderPath.trim() && (
                        <>
                          <span className="text-white/30"> / </span>
                          <span className="font-mono text-white">{folderPath.trim()}</span>
                        </>
                      )}
                    </p>
                    <p>
                      Framework: <span className="text-white">{detectFrameworkHint(folderPath, repoUrl)}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                      Branch
                    </label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={isDeploying || loadingBranches}
                      className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50"
                    >
                      {(branches.length ? branches : [branch]).map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                      Folder Path <span className="text-white/30">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="frontend or apps/web"
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      disabled={isDeploying}
                      className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50 font-mono"
                    />
                    <p className="text-xs text-tg-muted">Deploy a specific subfolder for monorepos. Leave empty to deploy repo root.</p>
                  </div>

                  <label className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-tg-black border border-white/10">
                    <input
                      type="checkbox"
                      checked={autoConnect}
                      onChange={(e) => setAutoConnect(e.target.checked)}
                      disabled={isDeploying}
                      className="accent-tg-lime"
                    />
                    <span className="text-xs text-tg-muted">
                      Auto-connect this repo for future push-based deployments in this same step.
                    </span>
                  </label>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Repository URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isDeploying}
                  required
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50"
                />
              </div>

              {/* Domain */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  ENS Domain
                </label>
                <input
                  type="text"
                  value={domain}
                  readOnly
                  disabled={isDeploying}
                  required
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-tg-muted">Fixed for this demo run.</p>
              </div>

              {/* Domain mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Domain Mode
                </label>
                <div className="flex space-x-2">
                  {(["auto", "custom"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDomainMode(mode)}
                      disabled={isDeploying}
                      className={`flex-1 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase border transition-colors disabled:opacity-50 ${
                        domainMode === mode
                          ? "bg-tg-lime/10 border-tg-lime/30 text-tg-lime"
                          : "bg-transparent border-white/10 text-tg-muted hover:border-white/20"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {domainMode === "custom" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">IPNS Key</label>
                  <input
                    type="text"
                    placeholder="k51..."
                    value={ipnsKey}
                    onChange={(e) => setIpnsKey(e.target.value)}
                    disabled={isDeploying}
                    required
                    className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50 font-mono"
                  />
                  <p className="text-xs text-tg-muted">Custom ENS deploys require fixed IPNS key so only IPNS {"->"} IPFS changes on deploy.</p>
                </div>
              )}

              {/* Environment */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Environment
                </label>
                <div className="flex space-x-2">
                  {(["production", "preview"] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEnv(e)}
                      disabled={isDeploying}
                      className={`flex-1 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase border transition-colors disabled:opacity-50 ${
                        env === e
                          ? "bg-tg-lavender/10 border-tg-lavender/40 text-tg-lavender"
                          : "bg-transparent border-white/10 text-tg-muted hover:border-white/20"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">
                  Metadata <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. v1.2.0 — production release"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  disabled={isDeploying}
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50"
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                {isDeploying ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-3 rounded-full font-bold text-sm tracking-wide hover:bg-red-500/20 transition-all"
                  >
                    CANCEL
                  </button>
                ) : (
                  <>
                    <button
                      type="submit"
                      className="flex-1 bg-tg-lavender text-tg-black px-6 py-3 rounded-full font-bold text-sm tracking-wide hover:opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>DEPLOY</span>
                    </button>
                    {(status === "done" || status === "error") && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-6 py-3 rounded-full font-bold text-sm tracking-wide border border-white/10 text-tg-muted hover:text-white hover:border-white/30 transition-all"
                      >
                        RESET
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>

          {/* Log Stream + Receipt */}
          <div className="md:col-span-7 space-y-4">

            {/* Log window */}
            <div className="rounded-card bg-tg-gray border border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-bold">Build Log</h2>
                <div className="flex items-center space-x-2">
                  {isDeploying && (
                    <div className="flex items-center space-x-2 text-tg-lime">
                      <div className="w-2 h-2 rounded-full bg-tg-lime animate-pulse" />
                      <span className="text-xs font-bold tracking-widest uppercase">Deploying</span>
                    </div>
                  )}
                  {status === "done" && (
                    <div className="flex items-center space-x-2 text-tg-lime">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-bold tracking-widest uppercase">Done</span>
                    </div>
                  )}
                  {status === "error" && (
                    <div className="flex items-center space-x-2 text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-xs font-bold tracking-widest uppercase">Failed</span>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={logRef}
                className="bg-tg-black rounded-2xl border border-white/5 p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed"
              >
                {logs.length === 0 && status === "idle" && (
                  <span className="text-tg-muted">Waiting for deployment to start…</span>
                )}
                {logs.map((line, i) => (
                  <div key={i} className={`${line.startsWith("ERROR") ? "text-red-400" : "text-green-400"}`}>
                    <span className="text-tg-muted select-none mr-2">{String(i + 1).padStart(3, "0")}</span>
                    {line}
                  </div>
                ))}
                {isDeploying && (
                  <div className="flex items-center space-x-1 text-tg-lavender mt-1">
                    <span className="animate-pulse">▋</span>
                  </div>
                )}
                {errMsg && (
                  <div className="text-red-400 mt-2 border-t border-red-500/20 pt-2">
                    ✗ {errMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt */}
            {receipt && status === "done" && (
              <div className="rounded-card bg-tg-lime p-6 text-tg-black">
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="font-display text-lg font-bold">Deployment Successful!</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {receipt.domain && (
                    <div className="flex justify-between">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">Domain</span>
                      <span className="font-mono font-bold">{receipt.domain}</span>
                    </div>
                  )}
                  {receipt.cid && (
                    <div className="flex justify-between">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">CID</span>
                      <span className="font-mono text-xs">{receipt.cid}</span>
                    </div>
                  )}
                  {receipt.ens?.name && (
                    <div className="flex justify-between">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">ENS</span>
                      <span className="font-mono text-xs">{String(receipt.ens.name)}</span>
                    </div>
                  )}
                  {receipt.ipns?.key && (
                    <div className="flex justify-between">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">IPNS</span>
                      <span className="font-mono text-xs">{String(receipt.ipns.key)}</span>
                    </div>
                  )}
                  {receipt.txHash && (
                    <div className="flex justify-between">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">TX</span>
                      <span className="font-mono text-xs">{String(receipt.txHash).slice(0, 20)}…</span>
                    </div>
                  )}
                  {receipt.gatewayUrl && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold opacity-60 uppercase text-xs tracking-widest">Gateway</span>
                      <a
                        href={String(receipt.gatewayUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs underline"
                      >
                        Open ↗
                      </a>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex space-x-3">
                  <Link href={`/projects/${encodeURIComponent(receipt.domain || DEMO_DOMAIN)}`}>
                    <button className="bg-tg-black text-white px-5 py-2 rounded-full font-bold text-xs tracking-wide hover:opacity-90 transition-all">
                      VIEW PROJECT
                    </button>
                  </Link>
                  <Link href="/dashboard">
                    <button className="border border-tg-black/20 text-tg-black px-5 py-2 rounded-full font-bold text-xs tracking-wide hover:bg-tg-black/10 transition-all">
                      DASHBOARD
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
