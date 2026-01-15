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

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

function safeJsonParse(raw: string | undefined | null): any | null {
  if (!raw) return null;
  try {
    // Cookie value is URI-encoded JSON in our app.
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Server-side: resolve the currently authenticated user id from cookies/headers
 * and enrich with pi_users (if present).
 *
 * IMPORTANT: does not change any login flow; it only reads.
 */
export async function getUserFromRequest(req: Request): Promise<LotteryAuthUser | null> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return null;

  // First priority: cookie set by our own Pi-login flow.
  // This avoids false FORBIDDEN when Supabase admin env is missing on some hosts.
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const piCookieRaw = cookies["pitodo_pi_user"];
  const piCookie = safeJsonParse(piCookieRaw);
  const cookiePiUsername =
    (piCookie?.username ?? piCookie?.piUsername ?? piCookie?.pi_username ?? null) as string | null;
  const cookieIsRoot =
    String(cookiePiUsername || "")
      .trim()
      .toLowerCase() === ROOT_ADMIN_USERNAME;

  // Enrich from DB (best-effort). Never throw here.
  try {
    const admin = getSupabaseAdminClient();
    const { data: pi, error } = await admin
      .from("pi_users")
      .select("pi_username,user_role,email")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // If no row / RLS quirks, still return basic identity using cookie if present.
      return {
        userId,
        piUsername: cookiePiUsername,
        isRootAdmin: cookieIsRoot,
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
      // Root admin can be verified by DB or by the Pi cookie.
      isRootAdmin:
        String(piUsername || "")
          .trim()
          .toLowerCase() === ROOT_ADMIN_USERNAME || cookieIsRoot,
    };
  } catch {
    return {
      userId,
      piUsername: cookiePiUsername,
      isRootAdmin: cookieIsRoot,
    };
  }
}

export function isRootAdmin(user: LotteryAuthUser | null | undefined): boolean {
  return Boolean(user?.isRootAdmin);
}
