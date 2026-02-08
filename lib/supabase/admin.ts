import { createClient } from "@supabase/supabase-js";

// Server-side Supabase (service role) — used for profile/identity/wallet provisioning.
// NEVER expose service role key to client.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!serviceKey) throw new Error("MISSING_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
