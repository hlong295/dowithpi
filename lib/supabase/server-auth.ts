import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseAnonServer() {
  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!anonKey) throw new Error("MISSING_ANON_KEY");
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getUserFromBearer(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  if (!token) return { user: null, token: null };

  const supabase = getSupabaseAnonServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { user: null, token };
  return { user: data.user, token };
}
