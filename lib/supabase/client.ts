import { createClient } from "@supabase/supabase-js";

// Client-side Supabase (anon) — used ONLY for authentication.
// TSBIO Constitution: token/wallet/ledger operations MUST go through server APIs.

declare global {
  interface Window {
    __TSBIO_PUBLIC_ENV__?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  }
}

// Prefer build-time NEXT_PUBLIC_* (standard). If missing, fall back to runtime-injected window.__TSBIO_PUBLIC_ENV__
// (needed for some Pi Studio / hosting environments).
const runtimeEnv = typeof window !== "undefined" ? window.__TSBIO_PUBLIC_ENV__ : undefined;

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || runtimeEnv?.supabaseUrl || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || runtimeEnv?.supabaseAnonKey || "").trim();

if (!url || !anonKey) {
  // Do not throw during import, but keep a very clear warning.
  // Without anon key, Supabase Auth will return: "No API key found in request".
  console.warn(
    "[TSBIO] Missing Supabase public config. Please set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (build-time) or provide runtime window.__TSBIO_PUBLIC_ENV__."
  );
}

// Defensive: explicitly set apikey/Authorization headers (some environments strip defaults if anonKey is empty).
// NOTE: Do NOT set a fixed `Authorization` header here.
// Supabase Auth will dynamically set `Authorization: Bearer <access_token>` for authenticated requests.
// If we force Authorization to the anon key, sessions will look "logged in" in UI but fail on real API calls.
export const supabaseBrowser = createClient(url || "", anonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  global: {
    headers: anonKey ? { apikey: anonKey } : undefined,
  },
});
