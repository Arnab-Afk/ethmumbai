"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  saveToken,
  getToken,
  clearToken,
  getSites,
  getSite,
  getDeployStatus,
  SiteDetail,
  DeployStatus,
} from "@/lib/api";
import Navbar from "@/components/navbar";

// Truncate a CID for display
function shortCid(cid: string) {
  if (!cid) return "—";
  return cid.length > 14 ? `${cid.slice(0, 7)}...${cid.slice(-6)}` : cid;
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface SiteRow {
  domain: string;
  detail: SiteDetail | null;
  loading: boolean;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [domains, setDomains] = useState<string[]>([]);
  const [siteRows, setSiteRows] = useState<SiteRow[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle token from OAuth redirect (?token=...)
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      saveToken(token);
      // Clean the URL to remove the token
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      setLoading(true);
      const [sitesRes, statusRes] = await Promise.all([
        getSites(),
        getDeployStatus(),
      ]);
      setDomains(sitesRes.domains);
      setDeployStatus(statusRes);

      // Initialize rows
      const rows: SiteRow[] = sitesRes.domains.map((d) => ({
        domain: d,
        detail: null,
        loading: true,
      }));
      setSiteRows(rows);

      // Fetch details for each site (limit to first 10 to avoid flooding)
      const toFetch = sitesRes.domains.slice(0, 10);
      for (const domain of toFetch) {
        getSite(domain)
          .then((detail) => {
            setSiteRows((prev) =>
              prev.map((r) =>
                r.domain === domain ? { ...r, detail, loading: false } : r
              )
            );
          })
          .catch(() => {
            setSiteRows((prev) =>
              prev.map((r) =>
                r.domain === domain ? { ...r, loading: false } : r
              )
            );
          });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("401") || err.message.includes("Authentication")) {
          clearToken();
        } else {
          setError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = searchParams.get("token");
    // Wait until after token is saved to load
    if (!token) {
      loadData();
    }
  }, [loadData, searchParams]);

  return (
    <div className="min-h-screen bg-tg-black text-white font-sans antialiased p-6 md:p-12">
      <main className="max-w-7xl mx-auto space-y-6">
        <Navbar />

        {/* ─── Metric Cards Row ─── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Active Deploys */}
          <div className="md:col-span-4 rounded-card bg-tg-gray p-8 border border-white/5 flex flex-col justify-between min-h-36 transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex justify-between items-start">
              <span className="text-tg-muted text-xs font-bold tracking-widest uppercase">Active Deploys</span>
              <svg className="text-tg-lavender w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div>
              <span className="font-display text-5xl font-bold block">
                {deployStatus ? deployStatus.active : "—"}
              </span>
              <span className="text-tg-lime text-xs font-medium mt-2 block">
                max {deployStatus?.max ?? 3} concurrent
              </span>
            </div>
          </div>

          {/* IPFS Sites */}
          <div className="md:col-span-4 rounded-card bg-tg-gray p-8 border border-white/5 flex flex-col justify-between min-h-36 transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex justify-between items-start">
              <span className="text-tg-muted text-xs font-bold tracking-widest uppercase">IPFS Sites</span>
              <svg className="text-tg-lime w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div>
              <span className="font-display text-5xl font-bold block">
                {loading ? "…" : domains.length}
              </span>
              <span className="text-tg-muted text-xs font-medium mt-2 block uppercase tracking-widest">
                Pinned Deployments
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="md:col-span-4 rounded-card bg-tg-lime p-8 flex flex-col justify-between text-tg-black transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex justify-between items-start">
              <span className="text-tg-black/60 text-xs font-bold tracking-widest uppercase">Quick Deploy</span>
              <svg className="w-6 h-6 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            <div>
              <p className="text-tg-black/70 text-sm mb-4">Ship a new deployment from any Git repo URL.</p>
              <Link href="/deploy">
                <button className="bg-tg-black text-white px-6 py-3 rounded-full font-bold text-xs tracking-wide hover:opacity-90 transition-all">
                  DEPLOY NOW →
                </button>
              </Link>
            </div>
          </div>

          {/* Active Projects Table */}
          <section className="md:col-span-12 rounded-card bg-tg-gray border border-white/5 p-8">
            <div className="flex justify-between items-end mb-8">
              <h2 className="font-display text-2xl font-bold">Active Projects</h2>
              <div className="flex items-center space-x-4">
                <Link href="/connect" className="text-tg-lavender text-xs font-bold tracking-widest hover:underline">
                  CONNECT REPO
                </Link>
                <Link href="/deploy" className="text-tg-lime text-xs font-bold tracking-widest hover:underline">
                  + NEW DEPLOY
                </Link>
              </div>
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {loading && domains.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-2 border-tg-lavender border-t-transparent rounded-full animate-spin" />
                  <span className="text-tg-muted text-sm">Loading projects…</span>
                </div>
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-tg-lavender/10 border border-tg-lavender/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-tg-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="font-display text-lg font-bold mb-2">No deployments yet</h3>
                <p className="text-tg-muted text-sm mb-6">Deploy your first decentralized site to get started.</p>
                <Link href="/deploy">
                  <button className="bg-tg-lavender text-tg-black px-6 py-3 rounded-full font-bold text-sm tracking-wide hover:opacity-90 transition-all">
                    DEPLOY YOUR FIRST SITE
                  </button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-tg-muted text-xs font-bold tracking-widest uppercase border-b border-white/5">
                      <th className="pb-4 font-bold">DOMAIN</th>
                      <th className="pb-4 font-bold">STATUS</th>
                      <th className="pb-4 font-bold">LATEST CID</th>
                      <th className="pb-4 font-bold">ENV</th>
                      <th className="pb-4 font-bold">DEPLOYED</th>
                      <th className="pb-4 font-bold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {siteRows.map(({ domain, detail, loading: rowLoading }) => (
                      <tr key={domain} className="group hover:bg-white/5 transition-colors">
                        <td className="py-6 font-display font-semibold text-lg">{domain}</td>
                        <td className="py-6">
                          {detail?.latest ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-tg-lime/10 text-tg-lime border border-tg-lime/20">
                              Online
                            </span>
                          ) : rowLoading ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-tg-lavender/10 text-tg-lavender border border-tg-lavender/20">
                              Loading…
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-white/5 text-tg-muted border border-white/10">
                              Unknown
                            </span>
                          )}
                        </td>
                        <td className="py-6 font-mono text-sm text-tg-muted">
                          {detail?.latest ? shortCid(detail.latest.cid) : "—"}
                        </td>
                        <td className="py-6">
                          {detail?.latest?.env ? (
                            <span className="text-xs text-tg-muted uppercase tracking-widest">
                              {detail.latest.env}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-6 text-sm text-tg-muted">
                          {detail?.latest?.timestamp ? timeAgo(detail.latest.timestamp) : "—"}
                        </td>
                        <td className="py-6 text-right">
                          <Link href={`/projects/${encodeURIComponent(domain)}`}>
                            <button className="p-2 rounded-full border border-white/10 group-hover:bg-tg-lavender group-hover:text-tg-black transition-all">
                              <svg className="w-4 h-4 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-tg-muted text-xs font-medium">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <span>© 2024 EVERDEPLOY FOUNDATION</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span className="hover:text-white cursor-pointer transition-colors">TERMS OF SERVICE</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-white transition-colors">TWITTER</a>
            <a href="#" className="hover:text-white transition-colors">GITHUB</a>
            <a href="#" className="hover:text-white transition-colors text-tg-lime">SYSTEM STATUS: OPTIMAL</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
