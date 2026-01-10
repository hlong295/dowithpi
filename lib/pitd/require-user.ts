import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

// Server-only helper:
// - DOES NOT change login flow.
// - Adds minimal validation/permission checks for PITD APIs.

function getAdminSupabase() {
  // Server-only admin client (service role key is kept server-side).
  return getSupabaseAdminClient();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function tryParseJson(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function extractUserIdFromPiCookie(raw: string): string {
  // pitodo_pi_user is set by /api/auth/pi-login-complete and currently stores JSON.
  // We must NOT return the raw JSON string (it will break uuid queries).
  const obj = tryParseJson(raw);
  if (obj && typeof obj === "object") {
    const anyObj = obj as any;
    // Prefer piUserId (pi_users.id) which is also mirrored as public.users.id in the current baseline.
    const candidates = [anyObj.piUserId, anyObj.userId, anyObj.id, anyObj.pi_user_id];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
      // Sometimes payloads may be nested like { id: "uuid" }
      if (c && typeof c === "object" && typeof c.id === "string" && c.id.trim()) return c.id.trim();
    }
    // If cookie is JSON but doesn't include a usable id, DO NOT return raw JSON.
    return "";
  }
  // If not JSON, return raw as-is (it may be a uuid or pi_username).
  return String(raw || "");
}

// Resolve non-UUID identifiers (pi_username / pi_uid / etc.) into an internal users.id.
// This is used only for PITD server APIs to prevent "invalid input syntax for type uuid".
async function resolveInternalUserId(candidate: any): Promise<string | null> {
  // Be defensive: in Pi Browser / Studio we may see unexpected values.
  if (typeof candidate !== "string") return null;
  const v = candidate.trim();
  if (!v) return null;
  if (isUuid(v)) return v;

  const supabase = getAdminSupabase();

  // Try to resolve by pi_username or pi_uid from pi_users.
  // NOTE: keep it minimal and tolerant – different deployments may store either.
  const { data: piUser, error: piErr } = await supabase
    .from("pi_users")
    .select("id")
    .or(`pi_username.eq.${v},pi_uid.eq.${v}`)
    .maybeSingle();

  if (piErr) {
    // Don't hard-fail; just return null so caller can decide.
    return null;
  }
  if (piUser?.id && typeof piUser.id === "string") {
    const master = await resolveMasterUserId(supabase, piUser.id);
    // resolveMasterUserId returns { userId }, not { masterUserId }
    return (master as any)?.userId || piUser.id;
  }

  return null;
}

export type UserRole = "root_admin" | "redeemer" | "provider" | "system" | string;

export async function requireUserExists(userId: string) {
  const supabase = getAdminSupabase();

  // Defensive: some callers may pass a non-uuid value (e.g. a JSON cookie or pi_uid).
  // Resolve to internal users.id first to avoid Postgres "invalid input syntax for type uuid" errors.
  let resolved = userId;
  if (!isUuid(resolved)) {
    const r = await resolveInternalUserId(resolved);
    if (r) resolved = r;
  }

  // IMPORTANT: public.users schema may differ between deployments.
  // We must NOT select non-existent columns here (would break admin features in Pi Browser).
  // Use select("*") and then pick role/type fields if present.
  const { data, error } = await supabase.from("users").select("*").eq("id", resolved).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    // In some PITODO deployments, public.users is used only as an id registry,
    // while roles live on pi_users. If the users row is missing, fallback to pi_users
    // so admin features (grant/revoke PITD) don't break.
    const { data: pu, error: puErr } = await supabase
      .from("pi_users")
      .select("id,user_role")
      .eq("id", resolved)
      .maybeSingle();
    if (puErr) throw new Error(puErr.message);
    if (!pu) throw new Error("USER_NOT_FOUND");
    const pr = ((pu as any).user_role ?? null) as any;
    return { id: (pu as any).id, user_role: pr, user_type: null };
  }

  const anyData: any = data as any;
  const user_role: UserRole | null = (anyData.user_role ?? anyData.role ?? null) as any;
  const user_type: string | null = (anyData.user_type ?? anyData.type ?? null) as any;
  return { id: anyData.id, user_role, user_type };
}

export async function requireAdmin(userId: string) {
  const u = await requireUserExists(userId);
  const role = (u.user_role || "").toLowerCase();
  // Primary admin check on public.users
  if (role === "root_admin" || role === "admin" || role === "system" || role === "super_admin") {
    return u;
  }

  // Fallback: some deployments store roles on pi_users (especially for Pi login)
  // while keeping public.users as the master id table.
  try {
    const sb = getAdminSupabase();
    const { data } = await sb
      .from("pi_users")
      .select("id,user_role")
      .eq("id", u.id)
      .maybeSingle();
    const pr = ((data as any)?.user_role || "").toLowerCase();
    if (pr === "root_admin" || pr === "admin" || pr === "system" || pr === "super_admin") {
      return u;
    }
  } catch {
    // ignore
  }

  throw new Error("FORBIDDEN_NOT_ADMIN");
}

export function requireSameUser(requesterId: string, targetUserId: string) {
  if (!requesterId || !targetUserId) throw new Error("MISSING_USER_ID");
  if (requesterId !== targetUserId) throw new Error("FORBIDDEN_USER_MISMATCH");
}

// ---- Auth resolution for PITD APIs (server-only) ----

function parseCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

/**
 * Best-effort extraction of a user id from a request.
 *
 * IMPORTANT: This does NOT verify auth validity. Use it only for telemetry/debug
 * or when another layer already verified the session.
 *
 * Priority:
 * 1) headers: x-user-id / x-pi-user-id (server-to-server)
 * 2) cookies: pitodo_pi_user / pi_user_id
 */
export function extractUserIdFromRequest(req: any): string | null {
  try {
    const headersObj = req?.headers;
    const getHeader = (name: string): string | null => {
      try {
        if (headersObj?.get) return headersObj.get(name);
        return headersObj?.[name] ?? headersObj?.[name.toLowerCase()] ?? null;
      } catch {
        return null;
      }
    };

    const headerUserId = getHeader("x-user-id") || getHeader("x-pi-user-id");
    if (headerUserId && typeof headerUserId === "string") return headerUserId;

    const cookieHeader = getHeader("cookie");
    const cookieUserId =
      parseCookieValue(cookieHeader, "pitodo_pi_user") || parseCookieValue(cookieHeader, "pi_user_id");
    return cookieUserId || null;
  } catch {
    return null;
  }
}

/**
 * Resolve an authenticated user id for PITD routes without changing the existing login flows.
 *
 * IMPORTANT: Pi-user flows may occasionally carry a Supabase bearer token that does NOT match
 * the Pi user id used elsewhere (stale session / different auth identity). If we prioritize bearer
 * first, we can end up recording purchases under a different user_id than the account page queries.
 *
 * Priority:
 * 1) x-pi-user-id header (explicit Pi user id from client)
 * 2) Pi cookie (pitodo_pi_user / pi_user_id)
 * 3) Authorization: Bearer <supabase access token> (verified server-side)
 */
export async function getAuthenticatedUserId(req: Request) {
  // 1) Explicit Pi user id from client
  const hPi = req.headers.get("x-pi-user-id");
  if (hPi) return extractUserIdFromPiCookie(hPi);

  // 2) Pi login cookie (may be blocked in some embedded contexts unless SameSite=None)
  const cookieHeader = req.headers.get("cookie");
  const piUser =
    parseCookieValue(cookieHeader, "pitodo_pi_user") ||
    parseCookieValue(cookieHeader, "pi_user_id");
  if (piUser) return extractUserIdFromPiCookie(piUser);

  // 3) Supabase access token forwarded by client (email/user login)
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user?.id) return data.user.id;
      } catch {
        // fall through
      }
    }
  }

  // 4) x-user-id fallback (kept for backwards compatibility in same-origin calls)
  const hUser = req.headers.get("x-user-id");
  if (hUser) return extractUserIdFromPiCookie(hUser);

  return null;
}
