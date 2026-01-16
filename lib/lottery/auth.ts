import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Keep ONE canonical value used across lottery routes.
// Root admin in this workspace is the Pi username.
export const ROOT_ADMIN_USERNAME = "hlong295";

function normalizeUsername(u: string | null | undefined): string {
  return String(u ?? "").trim().toLowerCase();
}

export function isRootAdminUsername(username: string | null | undefined): boolean {
  return normalizeUsername(username) === normalizeUsername(ROOT_ADMIN_USERNAME);
}

export type LotteryAuthUser = {
  // Internal user id (uuid) when available. In Pi App Studio / Pi Browser
  // environments, server-side auth/session resolution can be flaky; for root
  // admin gating we still allow using the Pi username even when userId is null.
  userId: string | null;
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
    // Some hosts/browsers may store plain strings (e.g. "hlong295")
    // or non-URI-encoded JSON. Try a couple of fallbacks.
    try {
      return JSON.parse(raw);
    } catch {
      const trimmed = String(raw).trim();
      return trimmed ? { username: trimmed } : null;
    }
  }
}

/**
 * Server-side: resolve the currently authenticated user id from cookies/headers
 * and enrich with pi_users (if present).
 *
 * IMPORTANT: does not change any login flow; it only reads.
 */
export async function getUserFromRequest(req: Request): Promise<LotteryAuthUser | null> {
  // Primary: resolve from Supabase-auth cookies (works on normal web hosting).
  // On Pi App Studio / Pi Browser, server routes may not receive those cookies reliably,
  // so we also accept the same headers our client already sends (x-user-id, authorization, x-pi-username).
  let userId = await getAuthenticatedUserId(req);

  // Secondary: Authorization bearer token -> verified user id via Supabase Admin.
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice("Bearer ".length).trim() : "";
  if (!userId && bearer) {
    try {
      const admin = getSupabaseAdminClient();
      const { data } = await admin.auth.getUser(bearer);
      if (data?.user?.id) userId = data.user.id;
    } catch {
      // ignore; we'll try other fallbacks below
    }
  }

  // Tertiary: explicit user id header (sent by our app from the client session when available).
  // NOTE: In Pi App Studio / Pi Browser, we sometimes only have a Pi username in this header.
  // We intentionally DO NOT treat non-UUID values as userId here (security), but we *will* use
  // them later as a pi-username fallback for root-admin gating.
  let headerUserIdRaw = "";
  if (!userId) {
    headerUserIdRaw = (req.headers.get("x-user-id") || req.headers.get("x-supabase-user-id") || "").trim();
    // basic UUID v4-ish check to avoid accidentally accepting random strings
    if (/^[0-9a-fA-F-]{32,36}$/.test(headerUserIdRaw)) userId = headerUserIdRaw;
  } else {
    headerUserIdRaw = (req.headers.get("x-user-id") || req.headers.get("x-supabase-user-id") || "").trim();
  }

  // Even if we don't have a resolved auth userId (common on Pi App Studio),
  // we still want to accept our own pi username signals for root-admin gating.
  const reqUrl = (() => {
    try {
      return new URL(req.url);
    } catch {
      return null;
    }
  })();

  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const piCookieRaw = cookies["pitodo_pi_user"];
  const piCookie = safeJsonParse(piCookieRaw);
  // In some in-app webviews, custom headers may be dropped. Allow query params as a fallback.
  // In some in-app webviews, custom headers may be dropped. Accept multiple signals.
  // Priority: explicit x-pi-username header -> query param -> finally x-user-id when it's a username.
  const headerPiUsername = (() => {
    const direct = (
      req.headers.get("x-pi-username") ||
      req.headers.get("x-pi_username") ||
      reqUrl?.searchParams.get("pi_username") ||
      ""
    ).trim();
    if (direct) return direct;
    // If x-user-id is *not* a UUID, treat it as a username hint.
    const hu = String(headerUserIdRaw || "").trim();
    if (hu && !/^[0-9a-fA-F-]{32,36}$/.test(hu)) return hu;
    return "";
  })();

  if (!userId) {
    const piUsernameFallback = (headerPiUsername || piCookie?.pi_username || piCookie?.username || "").trim();
    if (!piUsernameFallback) return null;
    return {
      userId: null,
      piUsername: piUsernameFallback,
      email: null,
      userRole: null,
      isRootAdmin: isRootAdminUsername(piUsernameFallback),
    };
  }

  const cookiePiUsername =
    ((piCookie?.username ?? piCookie?.piUsername ?? piCookie?.pi_username ?? null) as string | null) ||
    (headerPiUsername ? headerPiUsername : null);
  const cookieIsRoot = isRootAdminUsername(cookiePiUsername);

  // Enrich from DB (best-effort). Never throw here.
  try {
    const admin = getSupabaseAdminClient();
    // Try resolve pi_username by id first...
    let pi: any = null;
    let error: any = null;
    ({ data: pi, error } = await admin
      .from("pi_users")
      // Some deployments use `user_role`, others use `role`. Read both.
      .select("pi_username,user_role,role,email")
      .eq("id", userId)
      .maybeSingle();

    // Some DB setups use pi_users.user_id as FK to users.id (master user).
    // If no row found and the column exists, try that as a fallback.
    if (!pi && !error) {
      const fallback = await admin
        .from("pi_users")
        .select("pi_username,user_role,email")
        .eq("user_id" as any, userId)
        .maybeSingle();
      if (!fallback.error) pi = fallback.data as any;
      // If the column doesn't exist, ignore and keep pi=null.
      if (fallback.error && String(fallback.error.message || "").includes("pi_users.user_id")) {
        // ignore
      }
    }

    if (error) {
      // If no row / RLS quirks, still return basic identity using cookie if present.
      return {
        userId,
        piUsername: cookiePiUsername,
        isRootAdmin: cookieIsRoot,
      };
    }

    const piUsername = pi?.pi_username ?? null;
    const userRole =
      (pi as any)?.user_role ??
      // fallback if column name is `role`
      (pi as any)?.role ??
      null;
    const email = (pi as any)?.email ?? null;

    const roleLower = String(userRole || "").trim().toLowerCase();

    return {
      userId,
      piUsername,
      email,
      userRole,
      // Root admin can be verified by DB or by the Pi cookie.
      isRootAdmin:
        roleLower === "root_admin" ||
        isRootAdminUsername(piUsername) ||
        cookieIsRoot,
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
