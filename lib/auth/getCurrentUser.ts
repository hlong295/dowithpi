import type { NextRequest } from "next/server";

import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email?: string | null;
  pi_username?: string | null;
  user_role?: string | null;
  // Optional: public.users may have a username/display field in some installs.
  username?: string | null;
};

/**
 * Resolve the currently authenticated user.
 *
 * Important: we prefer `getAuthenticatedUserId(req)` which supports the existing
 * header-based auth used across this codebase (Pi Browser / pinet), and falls back
 * to Supabase cookie session.
 */
export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  const supabaseServer = getSupabaseServerClient();

  // 1) Try header/cookie aware user id.
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return null;

  // 2) Try get email from auth session (if present).
  let email: string | null | undefined;
  try {
    const { data } = await supabaseServer.auth.getUser();
    email = data?.user?.email ?? null;
  } catch {
    // ignore
  }

  // 3) Enrich from public.pi_users (pi_username, user_role)
  const admin = getSupabaseAdminClient();
  let pi_username: string | null | undefined = null;
  let user_role: string | null | undefined = null;
  try {
    const { data } = await admin
      .from("pi_users")
      .select("pi_username,user_role")
      .eq("id", userId)
      .maybeSingle();

    pi_username = (data as any)?.pi_username ?? null;
    user_role = (data as any)?.user_role ?? null;
  } catch {
    // ignore
  }

  // 4) Enrich from public.users (optional username + email if present)
  let username: string | null | undefined = null;
  try {
    const { data } = await admin.from("users").select("*").eq("id", userId).maybeSingle();
    if (data) {
      // Some schemas use username/display_name; we read defensively.
      username =
        (data as any).username ??
        (data as any).display_name ??
        (data as any).name ??
        null;
      if (!email) email = (data as any).email ?? null;
    }
  } catch {
    // ignore
  }

  return {
    id: userId,
    email: email ?? null,
    pi_username: pi_username ?? null,
    user_role: user_role ?? null,
    username: username ?? null,
  };
}
