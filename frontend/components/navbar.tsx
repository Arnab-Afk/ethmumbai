"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clearToken, getToken, getTokenExpiryMs, User, getMe, logout } from "@/lib/api";
import { useRouter } from "next/navigation";

const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "d3ploy_last_activity";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function shortAddress(addr: string) {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const router = useRouter();

  const ethereum = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
  }, []);

  const handleLogout = useCallback((redirectToLogin = false) => {
    void logout().finally(() => {
      setUser(null);
      setWalletAddress(null);
      router.push(redirectToLogin ? "/login" : "/");
    });
  }, [router]);

  const touchActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const expiry = getTokenExpiryMs(token);
    if (expiry && Date.now() >= expiry) {
      handleLogout(true);
      return;
    }

    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, [handleLogout]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const updateActivity = () => {
      touchActivity();
    };

    touchActivity();

    window.addEventListener("click", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("scroll", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    const interval = window.setInterval(() => {
      const rawLast = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = rawLast ? Number(rawLast) : Date.now();
      if (Date.now() - lastActivity >= INACTIVITY_LOGOUT_MS) {
        handleLogout(true);
      }
    }, 30_000);

    return () => {
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
      window.clearInterval(interval);
    };
  }, [handleLogout, touchActivity]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "d3ploy_token") return;
      if (event.newValue) return;
      setUser(null);
      setWalletAddress(null);
      router.push("/login");
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const expiry = getTokenExpiryMs(token);
    if (!expiry) return;

    const msUntilExpiry = expiry - Date.now();
    if (msUntilExpiry <= 0) {
      handleLogout(true);
      return;
    }

    const timer = window.setTimeout(() => {
      handleLogout(true);
    }, msUntilExpiry);

    return () => {
      window.clearTimeout(timer);
    };
  }, [handleLogout]);

  useEffect(() => {
    if (!ethereum) return;

    let mounted = true;
    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!mounted) return;
        const list = accounts as string[];
        setWalletAddress(list?.[0] || null);
      })
      .catch(() => {
        if (mounted) setWalletAddress(null);
      });

    const onAccountsChanged = (accounts: unknown) => {
      const list = (accounts as string[]) || [];
      setWalletAddress(list[0] || null);
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);

    return () => {
      mounted = false;
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [ethereum]);

  async function handleConnectWallet() {
    if (!ethereum) return;
    try {
      setConnectingWallet(true);
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setWalletAddress(accounts?.[0] || null);
    } finally {
      setConnectingWallet(false);
    }
  }

  return (
    <nav className="flex justify-between items-center mb-12">
      {/* Logo */}
      <Link href="/" className="flex items-center space-x-2">
        <span style={{ fontFamily: 'var(--font-bitcount)' }} className="text-4xl tracking-tight text-white">
          D3PLOY
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center space-x-6">
        <a
          href="https://github.com/ishikabhoyar/ethmumbai"
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
            {walletAddress ? (
              <button
                onClick={() => setWalletAddress(null)}
                className="text-xs font-medium text-tg-lime border border-tg-lime/30 px-3 py-1.5 rounded-full hover:bg-tg-lime/10 transition-colors tracking-widest"
                title="Disconnect wallet from UI"
              >
                {shortAddress(walletAddress)}
              </button>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={connectingWallet || !ethereum}
                className="text-xs font-medium text-tg-lavender border border-tg-lavender/30 px-3 py-1.5 rounded-full hover:bg-tg-lavender/10 transition-colors tracking-widest disabled:opacity-50"
              >
                {connectingWallet ? "CONNECTING..." : "CONNECT WALLET"}
              </button>
            )}
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
                onClick={() => handleLogout()}
                className="text-xs font-medium text-red-300 border border-red-300/40 px-3 py-1.5 rounded-full hover:bg-red-400/10 hover:text-red-200 transition-colors tracking-widest"
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
