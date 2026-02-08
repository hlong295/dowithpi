import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Resolve email from an email-namespace username.
// - Email usernames: "hlong295" (lowercase)
// - Pi usernames: "pi_hlong295" (reserved)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const usernameRaw = searchParams.get("username") || "";
    const username = usernameRaw.trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: "MISSING_USERNAME" }, { status: 400 });
    }
    if (username.startsWith("pi_")) {
      return NextResponse.json({ error: "USERNAME_PI_NAMESPACE" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Find profile by username
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: "DB_ERROR", detail: profErr.message }, { status: 500 });
    }
    if (!prof?.id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const { data: ident, error: identErr } = await admin
      .from("identities")
      .select("provider_uid")
      .eq("profile_id", prof.id)
      .eq("provider", "email")
      .maybeSingle();

    if (identErr) {
      return NextResponse.json({ error: "DB_ERROR", detail: identErr.message }, { status: 500 });
    }
    if (!ident?.provider_uid) {
      return NextResponse.json({ error: "EMAIL_IDENTITY_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ email: ident.provider_uid, profile_id: prof.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: "RESOLVE_EMAIL_FAILED", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
