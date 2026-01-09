// Server-only Supabase admin client (Service ROLE) to bypass RLS for internal PITD/admin actions.
// IMPORTANT: Do NOT import this file in client components.

import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL as CFG_SUPABASE_URL } from "@/lib/supabase/config"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  CFG_SUPABASE_URL

// Server-only env. MUST be set on hosting (Vercel / server runtime).
// Be permissive on variable names to reduce deployment mistakes.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_JWT

function getProjectRefFromSupabaseUrl(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname || ""
    // typical: <project-ref>.supabase.co
    return host.split(".")[0] || null
  } catch {
    return null
  }
}

function base64UrlToUtf8(input: string): string {
  // base64url -> base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  // pad
  const padded = base64 + "===".slice((base64.length + 3) % 4)

  // Prefer atob when available (Edge runtime), otherwise Buffer (Node).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any
  if (typeof g.atob === "function") {
    const binary = g.atob(padded)
    // binary string -> utf8
    const bytes = Uint8Array.from(binary, (c: string) => c.charCodeAt(0))
    return new TextDecoder("utf-8").decode(bytes)
  }
  // Node.js
  // eslint-disable-next-line no-undef
  return Buffer.from(padded, "base64").toString("utf8")
}

function decodeJwtNoVerify(token?: string) {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const json = base64UrlToUtf8(parts[1])
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getAdminKeyDebugInfo() {
  const payload = decodeJwtNoVerify(SERVICE_ROLE_KEY)
  const role = payload?.role || payload?.["https://hasura.io/jwt/claims"]?.["x-hasura-role"] || null
  const iss = payload?.iss || null
  const aud = payload?.aud || null
  const refFromUrl = getProjectRefFromSupabaseUrl(SUPABASE_URL)
  const refFromIss = typeof iss === "string" ? iss.split("/").pop() || null : null
  return {
    hasServiceRoleKey: Boolean(SERVICE_ROLE_KEY),
    role,
    iss,
    aud,
    refFromUrl,
    refFromIss,
    keyPrefix: SERVICE_ROLE_KEY ? String(SERVICE_ROLE_KEY).slice(0, 6) + "…" : null,
    supabaseUrl: SUPABASE_URL,
  }
}

// Strong validation: check whether the provided service role key is accepted by THIS project's Auth (GoTrue) endpoint.
// If the key belongs to another Supabase project, this call will typically return 401/403.
// Only used for debugging to help triage "permission denied" issues.
export async function validateServiceRoleKeyAgainstProject() {
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL

  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 0,
      error: "MISSING_ENV",
      detail: "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    }
  }

  // Supabase Auth admin endpoint
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users?page=1&per_page=1`
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    })

    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      // keep response small; Pi Browser needs concise payload
      bodyPreview: text ? text.slice(0, 180) : "",
    }
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      error: e?.message || "FETCH_FAILED",
    }
  }
}

export function getSupabaseAdminClient() {
  // Never fall back to ANON for PITD internal operations.
  // If missing, fail fast with a clear error.
  if (!SERVICE_ROLE_KEY) {
    throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY")
  }

  // Validate the key really is a Supabase service_role JWT.
  // If user accidentally pasted ANON key or other JWT, RLS will still deny.
  const payload = decodeJwtNoVerify(SERVICE_ROLE_KEY)
  const role = payload?.role || payload?.["https://hasura.io/jwt/claims"]?.["x-hasura-role"] || null
  if (!role) {
    throw new Error("INVALID_SUPABASE_SERVICE_ROLE_KEY_FORMAT")
  }
  if (role !== "service_role") {
    throw new Error("INVALID_SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Compatibility export for older imports
export const getAdminSupabase = getSupabaseAdminClient
