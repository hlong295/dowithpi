import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@supabase/supabase-js";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

export { resolveMasterUserId };

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
  const supabase = getAdminSupabase();

  // UUID can be either:
  // - public.users.id (master user id)
  // - public.pi_users.id (pi user id)
  // We must resolve pi_users.id -> master user id, otherwise
  // internal APIs that expect master IDs will fail.
  if (isUuid(v)) {
    // 1) If it already exists in public.users, treat it as master.
    const { data: u, error: uErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", v)
      .maybeSingle();
    if (!uErr && u?.id) return u.id;

    // 2) Otherwise, try as pi_users.id and resolve/ensure master.
    const { data: piUser, error: piErr } = await supabase
      .from("pi_users")
      .select("id")
      .eq("id", v)
      .maybeSingle();
    if (!piErr && piUser?.id) {
      const { userId } = await resolveMasterUserId(supabase, piUser.id);
      return userId || null;
    }

    // 3) Unknown UUID
    return null;
  }

  // Try to resolve by pi_username or pi_uid from pi_users.
  // NOTE: keep it minimal and tolerant – different deployments may store either.
  const { data: piUser, error: piErr } = await supabase
    .from("pi_users")
    .select("id")
    // IMPORTANT: Pi usernames can come with different casing across environments (Pi Browser / Studio).
    // Use case-insensitive match for pi_username to avoid false FORBIDDEN for the same account.
    .or(`pi_username.ilike.${v},pi_uid.eq.${v}`)
    .maybeSingle();

  if (piErr) {
    // Don't hard-fail; just return null so caller can decide.
    return null;
  }
  if (piUser?.id && typeof piUser.id === "string") {
    const { userId } = await resolveMasterUserId(supabase, piUser.id);
    return userId || piUser.id;
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

// ---------------------------------------------------------------------------
// Compatibility exports used by newer lottery routes.
// NOTE: These helpers do NOT change the login flows. They only read headers/
// cookies and then perform server-side permission checks.

export type RequireUserResult = {
  userId: string;
  username: string | null;
  authKind: "pi" | "email" | "unknown";
};

function guessAuthKind(req: Request): "pi" | "email" | "unknown" {
  // Heuristic only (used for gating "Pioneer required" features).
  // - Pi flow usually includes x-pi-user-id or x-pi-username.
  // - Email flow usually includes Authorization: Bearer <supabase token>.
  const hPi = (req.headers.get("x-pi-user-id") || "").trim();
  const hPiName = (req.headers.get("x-pi-username") || req.headers.get("x-pi_username") || "").trim();
  if (hPi || hPiName) return "pi";

  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return "email";

  return "unknown";
}

function extractUsernameHint(req: Request): string | null {
  // Best-effort (may be null for email users)
  const h = (req.headers.get("x-user-name") || req.headers.get("x-username") || "").trim();
  if (h) return h;
  const hp = (req.headers.get("x-pi-username") || req.headers.get("x-pi_username") || "").trim();
  if (hp) return hp;

  // Attempt to read from Pi cookie JSON (pitodo_pi_user)
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const raw = parseCookieValue(cookieHeader, "pitodo_pi_user");
  if (!raw) return null;
  const obj = tryParseJson(raw);
  const u = (obj as any)?.pi_username || (obj as any)?.piUsername || (obj as any)?.username;
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

/**
 * Used by lottery admin APIs.
 * - Resolve requester userId
 * - Ensure requester is admin
 */
export async function requireAdminUser(req: Request): Promise<RequireUserResult> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) throw new Error("UNAUTHORIZED");
  await requireAdmin(userId);
  return { userId, username: extractUsernameHint(req), authKind: guessAuthKind(req) };
}

/**
 * Used by lottery public APIs.
 * Returns authenticated user id + best-effort username.
 */
export async function getAuthenticatedUserIdWithName(req: Request): Promise<RequireUserResult> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) throw new Error("UNAUTHORIZED");
  return { userId, username: extractUsernameHint(req), authKind: guessAuthKind(req) };
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
  // IMPORTANT: In Pi Browser some cookies can be blocked; the client provides headers.
  // Prefer x-user-id (can be username or uuid) so server can resolve reliably.
  const hUser = req.headers.get("x-user-id");
  if (hUser) {
    const resolved = await resolveInternalUserId(hUser);
    if (resolved) return resolved;
  }

  // Next, explicit Pi user id header
  const hPi = req.headers.get("x-pi-user-id");
  if (hPi) {
    const resolved = await resolveInternalUserId(hPi);
    if (resolved) return resolved;
  }

  // Cookies (same-origin)
  const cookieHeader = req.headers.get("cookie");
  const piCookie =
    parseCookieValue(cookieHeader, "pitodo_pi_user") ||
    parseCookieValue(cookieHeader, "pi_user_id") ||
    parseCookieValue(cookieHeader, "pitodo_user");
  if (piCookie) {
    const extracted = extractUserIdFromPiCookie(piCookie) || piCookie;
    const resolved = await resolveInternalUserId(extracted);
    if (resolved) return resolved;
  }

  // Supabase access token forwarded by client (email/user login)
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      try {
        // Validate token without requiring the service role.
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user?.id) {
          // For profile reads we can safely use the authenticated user id.
          // PITD APIs that need master-resolution can still do it server-side
          // with service role when available.
          return data.user.id;
        }
      } catch {
        // fall through
      }
    }
  }

  return null;
}