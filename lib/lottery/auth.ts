import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Keep ONE canonical value used across lottery routes.
// Root admin in this workspace is the Pi username.
export const ROOT_ADMIN_USERNAME = "hlong295";

export type LotteryAuthUser = {
  userId: string;
  piUsername?: string | null;
  email?: string | null;
  userRole?: string | null;
  isRootAdmin: boolean;
};

/**
 * Server-side: resolve the currently authenticated user id from cookies/headers
 * and enrich with pi_users (if present).
 *
 * IMPORTANT: does not change any login flow; it only reads.
 */
export async function getUserFromRequest(req: Request): Promise<LotteryAuthUser | null> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return null;

  // Enrich from DB (best-effort). Never throw here.
  try {
    const admin = getSupabaseAdminClient();
    const { data: pi, error } = await admin
      .from("pi_users")
      .select("pi_username,user_role,email")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // If no row / RLS quirks, still return basic identity.
      return {
        userId,
        isRootAdmin: false,
      };
    }

    const piUsername = pi?.pi_username ?? null;
    const userRole = (pi as any)?.user_role ?? null;
    const email = (pi as any)?.email ?? null;

    return {
      userId,
      piUsername,
      email,
      userRole,
      isRootAdmin: String(piUsername || "").toLowerCase() === ROOT_ADMIN_USERNAME,
    };
  } catch {
    return {
      userId,
      isRootAdmin: false,
    };
  }
}

export function isRootAdmin(user: LotteryAuthUser | null | undefined): boolean {
  return Boolean(user?.isRootAdmin);
}
