"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken, getLoginUrl, getGoogleLoginUrl, getAuthProviders } from "@/lib/api";
import Navbar from "@/components/navbar";
import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [providers, setProviders] = useState({ github: true, google: false });

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    let mounted = true;

    getAuthProviders()
      .then(({ providers }) => {
        if (!mounted) return;
        const github = providers.find((p) => p.id === "github")?.available ?? false;
        const google = providers.find((p) => p.id === "google")?.available ?? false;
        setProviders({ github, google });
      })
      .catch(() => {
        // Fallback to GitHub-only when provider discovery is unavailable
        if (mounted) setProviders({ github: true, google: false });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-tg-black text-white font-sans antialiased p-6 md:p-12">
      <main className="max-w-7xl mx-auto">
        <Navbar />

        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="w-full max-w-md space-y-6">
            {/* Card */}
            <div className="rounded-card bg-tg-gray border border-white/5 p-10 text-center">
              {/* Logo */}
              <div className="w-16 h-16 bg-tg-lavender rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-9 h-9 text-tg-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <h1 className="font-display text-3xl font-extrabold mb-2">Welcome back</h1>
              <p className="text-tg-muted text-sm mb-8">
                Connect your GitHub to deploy censorship-resistant apps.
              </p>

              {/* Error banner */}
              {error && (
                <div className="mb-6 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error === "invalid_state" && "Session expired — please try again."}
                  {error === "server_error" && "Something went wrong on our end. Try again."}
                  {error !== "invalid_state" && error !== "server_error" && `Auth error: ${error}`}
                </div>
              )}

              {/* OAuth buttons */}
              <div className="space-y-3">
                {providers.github && (
                  <a href={getLoginUrl()} className="block w-full">
                    <button className="w-full bg-white text-tg-black px-6 py-4 rounded-full font-bold text-sm tracking-wide flex items-center justify-center space-x-3 hover:opacity-90 transition-all">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      <span>Continue with GitHub</span>
                    </button>
                  </a>
                )}

                {providers.google && (
                  <a href={getGoogleLoginUrl()} className="block w-full">
                    <button className="w-full bg-tg-black border border-white/15 text-white px-6 py-4 rounded-full font-bold text-sm tracking-wide flex items-center justify-center space-x-3 hover:border-white/30 transition-all">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.2-4.8 9.2-7.3 0-.5-.1-.9-.1-1.3H12z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </a>
                )}

                {!providers.github && !providers.google && (
                  <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-tg-muted text-sm">
                    No login provider is currently configured.
                  </div>
                )}
              </div>

              <p className="mt-6 text-tg-muted text-xs">
                By continuing you agree to our{" "}
                <span className="text-tg-lavender hover:underline cursor-pointer">Terms of Service</span>.
              </p>
            </div>

            {/* Back link */}
            <div className="text-center">
              <Link href="/" className="text-tg-muted text-sm hover:text-white transition-colors">
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
