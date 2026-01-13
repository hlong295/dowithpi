// Compatibility wrapper.
//
// Some routes historically imported getSupabaseAdminClient from "@/lib/supabase-admin".
// We now delegate to the canonical implementation in "@/lib/supabase/admin" which:
// - Uses the hard-coded project URL from lib/supabase/config.ts
// - Supports a server-only fallback for Pi App Studio / pinet hosting via lib/supabase/server-secrets.ts
//
// IMPORTANT: Do NOT import this file into client components.

export { getSupabaseAdminClient, getAdminKeyDebugInfo, validateServiceRoleKeyAgainstProject } from "@/lib/supabase/admin"
