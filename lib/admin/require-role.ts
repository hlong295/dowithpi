import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

export type AdminRole = "root_admin" | "editor" | "provider" | "approval";

export type RoleCheckOk = {
  ok: true;
  userId: string;
  email: string | null;
  profile: { id: string; username: string | null; role: string | null };
};

export type RoleCheckFail = {
  ok: false;
  status: number;
  error: string;
  detail?: string;
};

export type RoleCheckResult = RoleCheckOk | RoleCheckFail;

/**
 * Role guard.
 * - Root always passes.
 * - Editor/Provider depends on allowedRoles.
 */
export async function requireAdminRole(req: Request, allowedRoles: AdminRole[]): Promise<RoleCheckResult> {
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

  const role = (profile.role || "member") as string;
  if (role !== "root_admin" && !allowedRoles.includes(role as AdminRole)) {
    return { ok: false, status: 403, error: "FORBIDDEN_ROLE", detail: `role=${role}` };
  }

  return {
    ok: true,
    userId: user.id,
    email: (user.email || null) as string | null,
    profile: { id: profile.id, username: profile.username ?? null, role: profile.role ?? null },
  };
}
