// Server-only Supabase admin client (Service ROLE) to bypass RLS for internal PITD/admin actions.
// IMPORTANT: Do NOT import this file in client components.

import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL as CFG_SUPABASE_URL } from "@/lib/supabase/config"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  CFG_SUPABASE_URL

// Server-only env. MUST be set on hosting (Vercel / server runtime).
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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
