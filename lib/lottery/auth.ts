import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AuthKind = "pi" | "email";

/**
 * Best-effort: determine whether the current authenticated user is a Pi user (Pioneer).
 * We do NOT change any login flows; we only infer from request headers / DB.
 */
export async function inferAuthKind(
  params: {
    requesterName?: string | null;
    piUserIdHeader?: string | null;
    masterUserId: string;
  }
): Promise<AuthKind> {
  if (params.piUserIdHeader) return "pi";
  if (params.requesterName) return "pi";

  try {
    const sb = getSupabaseAdminClient();
    const { data } = await sb
      .from("pi_users")
      .select("pi_uid")
      .eq("id", params.masterUserId)
      .maybeSingle();
    if (data?.pi_uid) return "pi";
  } catch {
    // ignore
  }

  return "email";
}
