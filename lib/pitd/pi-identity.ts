// lib/pitd/pi-identity.ts
// Minimal, server-safe identity extractor used by API routes.
// - Pi Browser: reads `pi_user_id` cookie and optional `pitodo_pi_user` json cookie.
// - Email/Supabase Auth: falls back to extractUserIdFromRequest (server cookies/headers).
// Keep it pure (no DB calls) so it can't break auth flows.

import { extractUserIdFromRequest } from "./require-user";

export type PiIdentity = {
  /** Canonical user id used across server APIs (uuid). */
  userId: string | null;
  /** If available, the Pi login internal uuid (pi_users.id) OR raw Pi uid if older flows. */
  piUserId: string | null;
  /** Pi username when available. */
  piUsername: string | null;
};

function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function safeDecode(v: string | undefined | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function readCookie(req: any, name: string): string | null {
  try {
    // NextRequest cookies API
    if (req?.cookies?.get) {
      const got = req.cookies.get(name);
      if (typeof got === "string") return got;
      if (got?.value) return got.value;
    }
  } catch {
    // ignore
  }

  // Standard Request: parse Cookie header
  const cookieHeader = (() => {
    try {
      return req?.headers?.get?.("cookie") ?? req?.headers?.cookie ?? null;
    } catch {
      return null;
    }
  })();
  const cookies = parseCookieHeader(cookieHeader);
  return safeDecode(cookies[name]);
}

function readHeader(req: any, name: string): string | null {
  try {
    const v = req?.headers?.get?.(name);
    if (v) return v;
  } catch {
    // ignore
  }
  // Some callers pass plain objects
  const lower = name.toLowerCase();
  const h = req?.headers;
  if (h && typeof h === "object") {
    return (h[lower] ?? h[name] ?? null) as string | null;
  }
  return null;
}

/**
 * Extracts identity from a Request/NextRequest for purchases/payment APIs.
 */
export function getPiIdentityFromRequest(req: any): PiIdentity {
  // Prefer explicit headers if a client sends them
  const headerPiUserId = readHeader(req, "x-pi-user-id") || readHeader(req, "x-pitodo-pi-user-id");
  const headerPiUsername = readHeader(req, "x-pi-username") || readHeader(req, "x-pitodo-pi-username");

  // Cookies set by /api/auth/pi-login-complete
  const cookiePiUserId = readCookie(req, "pi_user_id");
  const cookiePiUsername = readCookie(req, "pi_username");

  // Optional JSON cookie used in some flows
  const pitodoPiUserRaw = readCookie(req, "pitodo_pi_user");
  let jsonPiUsername: string | null = null;
  try {
    if (pitodoPiUserRaw) {
      const obj = JSON.parse(pitodoPiUserRaw);
      if (obj?.username) jsonPiUsername = String(obj.username);
    }
  } catch {
    // ignore
  }

  const piUserId = headerPiUserId || cookiePiUserId || null;
  const piUsername = headerPiUsername || cookiePiUsername || jsonPiUsername || null;

  // Canonical user id for server-side tables (prefer auth-derived; fallback to piUserId)
  const userId = extractUserIdFromRequest(req) || piUserId || null;

  return { userId, piUserId, piUsername };
}
