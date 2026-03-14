"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, getToken, User, getMe } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
    router.push("/");
  }

  return (
    <nav className="flex justify-between items-center mb-12">
      {/* Logo */}
      <Link href="/" className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-tg-lavender rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-tg-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <span className="font-display text-xl font-bold tracking-tight text-white">
          D3PLOY
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center space-x-6">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-tg-muted cursor-pointer hover:text-white transition-colors tracking-widest"
        >
          DOCS
        </a>

        {user ? (
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-tg-muted hover:text-white transition-colors tracking-widest"
            >
              DASHBOARD
            </Link>
            <div className="flex items-center space-x-3">
              {user.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-tg-gray border border-white/10 flex items-center justify-center text-xs font-bold text-tg-lavender">
                  {user.login?.[0]?.toUpperCase()}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-tg-muted hover:text-white transition-colors tracking-widest"
              >
                LOGOUT
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login">
            <div className="h-10 w-10 rounded-full bg-tg-gray border border-white/10 flex items-center justify-center cursor-pointer hover:border-tg-lavender/50 transition-colors">
              <div className="w-2 h-2 rounded-full bg-tg-lime animate-pulse" />
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}
