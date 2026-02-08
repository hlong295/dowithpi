"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface PiUser {
  uid: string;
  username: string;
  accessToken: string;
  displayName?: string;
  role?: "admin" | "user";
  createdAt?: string;
}

export interface EmailUser {
  id: string;
  email: string;
  username?: string;
  role?: string;
  level?: number | null;
  emailVerified?: boolean;
  createdAt?: string | null;
  wallet?: {
    balance: number;
    locked: number;
  } | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  piUser: PiUser | null;
  emailUser: EmailUser | null;
  // Pi login (existing)
  login: (user: PiUser) => void;
  // Email auth helpers
  refreshEmailUser: () => Promise<void>;
  logout: () => Promise<void> | void;
  updateDisplayName: (displayName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [piUser, setPiUser] = useState<PiUser | null>(null);
  const [emailUser, setEmailUser] = useState<EmailUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Always derive auth flag from actual users (avoid stale state).
  useEffect(() => {
    setIsAuthenticated(!!piUser || !!emailUser);
  }, [piUser, emailUser]);

  // Load Pi user from localStorage (existing behavior)
  useEffect(() => {
    const storedUser = localStorage.getItem("tsbio_pi_user");
    if (!storedUser) return;
    try {
      const user = JSON.parse(storedUser);
      setPiUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("[TSBIO] Failed to parse stored Pi user:", error);
      localStorage.removeItem("tsbio_pi_user");
    }
  }, []);

  // Load Supabase email session (if any)
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!mounted) return;
        if (data?.session?.user) {
          setIsAuthenticated(true);
          await refreshEmailUserInternal();
        }
      } catch (e) {
        // env not set or supabase not ready
        console.warn("[TSBIO] Supabase session init failed:", (e as any)?.message || e);
      }
    }

    init();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setIsAuthenticated(true);
        await refreshEmailUserInternal();
      } else {
        setEmailUser(null);
        setIsAuthenticated(!!piUser);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  // Keep Supabase email session alive to prevent silent expiry that looks like "random logout".
  // This is especially important on mobile/PWA where background timers are throttled.
  useEffect(() => {
    let stopped = false;
    const intervalMs = 90_000; // 90s
    async function tick() {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (stopped) return;

        const session = data?.session;
        if (!session) return;

        // If token expires soon, refresh it.
        const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
        const msLeft = expiresAt ? expiresAt - Date.now() : null;

        if (msLeft !== null && msLeft < 120_000) {
          const { data: refreshed, error } = await supabaseBrowser.auth.refreshSession();
          if (error) {
            console.warn("[TSBIO] refreshSession failed:", error.message);
            // Do not nuke UI state immediately; just keep best-effort.
            return;
          }
          if (refreshed?.session?.user) {
            await refreshEmailUserInternal();
          }
        }
      } catch (e: any) {
        // Never force-logout on background refresh errors.
        console.warn("[TSBIO] session keepalive tick error:", e?.message || e);
      }
    }

    const t = setInterval(() => {
      tick();
    }, intervalMs);

    // run once quickly after mount
    tick();

    return () => {
      stopped = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const login = (user: PiUser) => {
    setPiUser(user);
    setIsAuthenticated(true);
    localStorage.setItem("tsbio_pi_user", JSON.stringify(user));
  };

  const updateDisplayName = (displayName: string) => {
    if (!piUser) return;
    const updatedUser = { ...piUser, displayName };
    setPiUser(updatedUser);
    localStorage.setItem("tsbio_pi_user", JSON.stringify(updatedUser));
  };

  async function refreshEmailUserInternal() {
    // IMPORTANT: never "force logout" just because the auth-bridge endpoint
    // temporarily fails. Supabase session is the source of truth.
    const { data: sessionData, error: sessionErr } = await supabaseBrowser.auth.getSession();
    if (sessionErr) {
      console.warn("auth.getSession error", sessionErr);
    }

    const session = sessionData.session;
    if (!session?.access_token) {
      setEmailUser(null);
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);

    // 1) Always populate a minimal user immediately from the session.
    // This prevents the UI from flickering back to the login form when the
    // /api/auth/me bridge is momentarily unavailable.
    const sessionUser = session.user;
    const fallbackUsername =
      (sessionUser?.user_metadata as any)?.username ||
      (sessionUser?.email ? sessionUser.email.split("@")[0] : undefined);

    const basicUser: EmailUser = {
      id: sessionUser.id,
      email: sessionUser.email || "",
      username: fallbackUsername,
      // role/is_admin will be enriched by the bridge if available
      role: "member",
      emailVerified: !!sessionUser.email_confirmed_at,
    };

    setEmailUser((prev) => {
      if (!prev || prev.id != basicUser.id) return basicUser;
      // keep any enriched fields from prev if we already had them
      return {
        ...basicUser,
        role: prev.role || basicUser.role,
        level: prev.level ?? basicUser.level,
        wallet: prev.wallet ?? basicUser.wallet,
      };
    });

    // 2) Enrich via server bridge (profile/role/wallet snapshot).
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        // Keep the session-based user; do NOT clear auth.
        const txt = await res.text().catch(() => "");
        console.warn("/api/auth/me non-ok", res.status, txt);
        return;
      }

      const data = await res.json();
      if (!data?.user?.id) {
        console.warn("/api/auth/me missing user payload", data);
        return;
      }

      setEmailUser(data.user);
    } catch (e) {
      // Keep the session-based user; do NOT clear auth.
      console.warn("refreshEmailUserInternal bridge error", e);
    }
  }

  // Public wrapper used by pages/components
  const refreshEmailUser = React.useCallback(async () => {
    await refreshEmailUserInternal();
  }, []);

  const logout = async () => {
    setPiUser(null);
    localStorage.removeItem("tsbio_pi_user");
    setEmailUser(null);
    try {
      await supabaseBrowser.auth.signOut();
      // Also clear persisted session keys (supabase-js stores tokens in localStorage)
      // to prevent "stuck" state across host aliases or redeploys.
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const m = url?.match(/^https:\/\/([^.]+)\.supabase\.co/);
      const ref = m?.[1];
      if (ref && typeof window !== "undefined" && window.localStorage) {
        const prefix = `sb-${ref}`;
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
      }
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      piUser,
      emailUser,
      login,
      refreshEmailUser,
      logout,
      updateDisplayName,
    }),
    [isAuthenticated, piUser, emailUser, refreshEmailUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
