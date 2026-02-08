import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

export type RootCheckOk = {
  ok: true;
  userId: string;
  email: string | null;
  profile: { id: string; username: string | null; role: string | null };
};

export type RootCheckFail = {
  ok: false;
  status: number;
  error: string;
  detail?: string;
};

export type RootCheckResult = RootCheckOk | RootCheckFail;

/**
 * Root lock rule:
 *   if (profile.role !== 'root_admin') deny
 */
export async function requireRootAdmin(req: Request): Promise<RootCheckResult> {
  const { user } = await getUserFromBearer(req);
  if (!user) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "PROFILE_LOOKUP_FAILED", detail: error.message };
  }
  if (!profile?.id) {
    return { ok: false, status: 403, error: "MISSING_PROFILE" };
  }
  if (profile.role !== "root_admin") {
    return { ok: false, status: 403, error: "FORBIDDEN_NOT_ROOT" };
  }

  return {
    ok: true,
    userId: user.id,
    email: (user.email || null) as string | null,
    profile: { id: profile.id, username: profile.username ?? null, role: profile.role ?? null },
  };
}
