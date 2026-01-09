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
  process.env.SERVICE_ROLE_KEY

function decodeJwtNoVerify(token?: string) {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getAdminKeyDebugInfo() {
  const payload = decodeJwtNoVerify(SERVICE_ROLE_KEY)
  const role = payload?.role || payload?.["https://hasura.io/jwt/claims"]?.["x-hasura-role"] || null
  return {
    hasServiceRoleKey: Boolean(SERVICE_ROLE_KEY),
    role,
    keyPrefix: SERVICE_ROLE_KEY ? String(SERVICE_ROLE_KEY).slice(0, 6) + "…" : null,
    supabaseUrl: SUPABASE_URL,
  }
}

export function getSupabaseAdminClient() {
  // Never fall back to ANON for PITD internal operations.
  // If missing, fail fast with a clear error.
  if (!SERVICE_ROLE_KEY) {
    throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Compatibility export for older imports
export const getAdminSupabase = getSupabaseAdminClient
