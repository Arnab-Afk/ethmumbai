"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken, deployStream, DeployReceipt } from "@/lib/api";
import Navbar from "@/components/navbar";

type DeployState = "idle" | "deploying" | "done" | "error";

export default function DeployPage() {
  const router = useRouter();

  const [repoUrl, setRepoUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [env, setEnv] = useState<"production" | "preview">("production");
  const [meta, setMeta] = useState("");

  const [status, setStatus] = useState<DeployState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<DeployReceipt | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // auth guard removed – all pages are open

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim() || !domain.trim()) return;

    setStatus("deploying");
    setLogs([]);
    setReceipt(null);
    setErrMsg(null);

    abortRef.current = deployStream(
      { repoUrl: repoUrl.trim(), domain: domain.trim(), env, meta: meta.trim() },
      (line) => setLogs((prev) => [...prev, line]),
      (r) => {
        setReceipt(r);
        setStatus("done");
      },
      (msg) => {
        setErrMsg(msg);
        setStatus("error");
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

            <form onSubmit={handleDeploy} className="space-y-5">
              {/* Repo URL */}
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
                  placeholder="myapp.eth"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isDeploying}
                  required
                  className="w-full bg-tg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-tg-muted focus:outline-none focus:border-tg-lavender transition-colors disabled:opacity-50 font-mono"
                />
              </div>

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
                  <Link href={`/projects/${encodeURIComponent(domain)}`}>
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
