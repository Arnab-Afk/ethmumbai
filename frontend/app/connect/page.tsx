"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getToken,
  clearToken,
  getRepos,
  getBranches,
  connectRepo,
  getConnectedRepos,
  disconnectRepo,
  Repo,
  ConnectedRepo,
} from "@/lib/api";
import Navbar from "@/components/navbar";

type Step = "repos" | "configure" | "success";

export default function ConnectPage() {
  const router = useRouter();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [connected, setConnected] = useState<ConnectedRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);

  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [branch, setBranch] = useState("main");
  const [domain, setDomain] = useState("");
  const [env, setEnv] = useState<"production" | "preview">("production");

  const [step, setStep] = useState<Step>("repos");
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadRepos();
    loadConnected();
  }, [router]);

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
        return;
      }
      if (e.message.includes("GitHub token")) {
        setReposError("GitHub access requires logging in with GitHub (not Google).");
      } else {
        setReposError(e.message);
      }
    } finally {
      setLoadingRepos(false);
    }
  }

  async function loadConnected() {
    try {
      const res = await getConnectedRepos();
      setConnected(res.repos);
    } catch {
      // non-fatal
    }
  }

  async function handleSelectRepo(repo: Repo) {
    setSelectedRepo(repo);
    setLoadingBranches(true);
    setBranches([]);
    try {
      const [owner, repoName] = repo.fullName.split("/");
      const res = await getBranches(owner, repoName);
      setBranches(res.branches);
      setBranch(repo.defaultBranch || "main");
    } catch {
      setBranches([repo.defaultBranch || "main"]);
      setBranch(repo.defaultBranch || "main");
    } finally {
      setLoadingBranches(false);
    }
    setStep("configure");
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepo || !domain.trim()) return;

    setConnecting(true);
    setConnectError(null);
    try {
      const res = await connectRepo({
        repoFullName: selectedRepo.fullName,
        branch,
        domain: domain.trim(),
        env,
      });
      setConnectResult(res.message);
      setStep("success");
      loadConnected();
    } catch (err: unknown) {
      setConnectError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(r: ConnectedRepo) {
    try {
      await disconnectRepo(r.owner, r.repo, r.branch);
      setConnected((prev) =>
        prev.filter(
          (c) => !(c.owner === r.owner && c.repo === r.repo && c.branch === r.branch)
        )
      );
    } catch {
      // ignore
    }
  }

  const filteredRepos = repos.filter((r) =>
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-tg-black text-white font-sans antialiased p-6 md:p-12">
      <main className="max-w-7xl mx-auto space-y-6">
        <Navbar />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold">Connect Repository</h1>
            <p className="text-tg-muted mt-1 text-sm">Link a GitHub repo to auto-deploy on every push.</p>
          </div>
          <Link href="/dashboard" className="text-tg-muted text-sm hover:text-white transition-colors font-medium">
            ← Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── Main flow ── */}
          <div className="md:col-span-7 space-y-4">

            {/* Step 1 – Pick a repo */}
            {step === "repos" && (
              <div className="rounded-card bg-tg-gray border border-white/5 p-8">
                <h2 className="font-display text-xl font-bold mb-2">Select a Repository</h2>
                <p className="text-tg-muted text-sm mb-6">Choose the GitHub repo you want to connect to D3PLOY.</p>

                {/* Search */}
                <div className="relative mb-4">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-tg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search repos…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-tg-black border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors"
                  />
                </div>

                {reposError && (
                  <div className="mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {reposError}
                  </div>
                )}

                {loadingRepos ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-tg-lavender border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <p className="text-tg-muted text-sm text-center py-8">No repos found.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {filteredRepos.map((repo) => (
                      <button
                        key={repo.fullName}
                        onClick={() => handleSelectRepo(repo)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/5 hover:border-tg-lavender/30 hover:bg-white/5 transition-all text-left group"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <svg className="w-4 h-4 text-tg-muted shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{repo.fullName}</p>
                            {repo.description && (
                              <p className="text-xs text-tg-muted truncate">{repo.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-4">
                          {repo.connected && (
                            <span className="text-[10px] font-bold tracking-widest uppercase text-tg-lime">Connected</span>
                          )}
                          {repo.private && (
                            <svg className="w-3 h-3 text-tg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                          <svg className="w-4 h-4 text-tg-muted group-hover:text-tg-lavender transition-colors -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2 – Configure */}
            {step === "configure" && selectedRepo && (
              <div className="rounded-card bg-tg-gray border border-white/5 p-8">
                <button
                  onClick={() => { setStep("repos"); setSelectedRepo(null); }}
                  className="text-tg-muted text-sm hover:text-white transition-colors mb-6 inline-flex items-center"
                >
                  ← Choose different repo
                </button>

                <div className="flex items-center space-x-3 mb-6 p-4 rounded-2xl bg-tg-black border border-white/5">
                  <svg className="w-5 h-5 text-tg-lavender shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span className="font-mono font-semibold">{selectedRepo.fullName}</span>
                </div>

                <form onSubmit={handleConnect} className="space-y-5">
                  {/* Branch */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">Branch</label>
                    {loadingBranches ? (
                      <div className="h-12 rounded-2xl bg-tg-black border border-white/10 flex items-center px-4">
                        <div className="w-4 h-4 border-2 border-tg-lavender border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-tg-lavender transition-colors appearance-none"
                      >
                        {branches.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Domain */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">ENS Domain</label>
                    <input
                      type="text"
                      placeholder="myapp.eth"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors font-mono"
                    />
                  </div>

                  {/* Environment */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-tg-muted">Environment</label>
                    <div className="flex space-x-2">
                      {(["production", "preview"] as const).map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setEnv(e)}
                          className={`flex-1 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase border transition-colors ${
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

                  {connectError && (
                    <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {connectError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={connecting}
                    className="w-full bg-tg-lavender text-tg-black px-6 py-4 rounded-full font-bold text-sm tracking-wide hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {connecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-tg-black border-t-transparent rounded-full animate-spin" />
                        <span>Connecting…</span>
                      </>
                    ) : (
                      <span>CONNECT REPOSITORY</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Step 3 – Success */}
            {step === "success" && (
              <div className="rounded-card bg-tg-lime p-8 text-tg-black">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-tg-black/10 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-display text-xl font-bold">Repository connected!</h3>
                </div>
                {connectResult && <p className="text-tg-black/70 text-sm mb-6">{connectResult}</p>}
                <div className="flex space-x-3">
                  <Link href="/dashboard">
                    <button className="bg-tg-black text-white px-6 py-3 rounded-full font-bold text-xs tracking-wide hover:opacity-90 transition-all">
                      DASHBOARD
                    </button>
                  </Link>
                  <button
                    onClick={() => { setStep("repos"); setSelectedRepo(null); setConnectResult(null); setBranch("main"); setDomain(""); }}
                    className="border border-tg-black/20 text-tg-black px-6 py-3 rounded-full font-bold text-xs tracking-wide hover:bg-tg-black/10 transition-all"
                  >
                    CONNECT ANOTHER
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Connected Repos sidebar */}
          <div className="md:col-span-5 rounded-card bg-tg-gray border border-white/5 p-8">
            <h2 className="font-display text-xl font-bold mb-6">Connected Repos</h2>
            {connected.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-tg-muted text-sm">No repos connected yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
                {connected.map((r) => (
                  <div key={`${r.owner}/${r.repo}/${r.branch}`} className="p-4 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold font-mono truncate">{r.repoFullName}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-tg-muted">branch: <span className="text-white font-mono">{r.branch}</span></span>
                          <span className="w-1 h-1 bg-white/20 rounded-full" />
                          <span className="text-xs text-tg-muted font-mono">{r.domain}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                            r.env === "production"
                              ? "bg-tg-lime/10 text-tg-lime border-tg-lime/20"
                              : "bg-tg-lavender/10 text-tg-lavender border-tg-lavender/20"
                          }`}>
                            {r.env}
                          </span>
                          {r.webhookId && (
                            <span className="text-[10px] text-tg-muted">webhook ✓</span>
                          )}
                        </div>
                        {r.recentDeploys.length > 0 && (
                          <p className="text-xs text-tg-muted mt-2">
                            Last deploy: {new Date(r.recentDeploys[0].timestamp * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDisconnect(r)}
                        className="ml-3 p-1.5 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        title="Disconnect"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
