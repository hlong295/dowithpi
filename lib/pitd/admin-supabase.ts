import { getSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Server-only Supabase client for admin PITD operations
 * Must be used ONLY inside app/api/**/route.ts
 */
export async function getAdminSupabase() {
  return await getSupabaseServerClient()
}
