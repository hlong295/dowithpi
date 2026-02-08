import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * IMPORTANT:
 * Supabase auth (email login) is persisted in localStorage (per-origin).
 * If users switch between `tsbio.life` and `www.tsbio.life`, they'll look
 * "logged in" on one origin and "logged out" on the other.
 *
 * To prevent hard-to-debug auth mismatches (the user called it "cookies" issue),
 * we enforce a single canonical host.
 *
 * We enforce `www.tsbio.life` as canonical.
 *
 * Why: if Vercel domain settings are configured to redirect `tsbio.life` → `www.tsbio.life`
 * (common for a "Primary" domain), and middleware redirects the other way, users will
 * hit ERR_TOO_MANY_REDIRECTS even in Incognito.
 */
export function middleware(req: NextRequest) {
  // NOTE:
  // We intentionally do NOT force www/non-www canonicalization here.
  // Domain canonicalization should be handled in Vercel "Domains" settings.
  // Enforcing it in middleware can create an infinite redirect loop when Vercel
  // is configured with the opposite redirect direction.
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
