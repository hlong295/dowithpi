import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Provision profile/identity/wallet right after email sign-up when session may be null
// (because email verification is enabled). This avoids "auth user orphan".

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      email?: string;
      username?: string;
    };

    const userId = (body.userId || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const username = (body.username || "").trim().toLowerCase();

    if (!userId || !email) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    if (username && username.startsWith("pi_")) {
      return NextResponse.json({ error: "USERNAME_RESERVED_PI" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Create/Upsert profile
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        username: username || null,
        role: "member",
      },
      { onConflict: "id" }
    );
    if (pErr) {
      return NextResponse.json({ error: "PROFILE_UPSERT_FAILED", details: pErr.message }, { status: 400 });
    }

    // Link identity email
    const { error: iErr } = await admin.from("identities").upsert(
      {
        profile_id: userId,
        provider: "email",
        provider_uid: email,
      },
      { onConflict: "provider,provider_uid" }
    );
    if (iErr) {
      return NextResponse.json({ error: "IDENTITY_UPSERT_FAILED", details: iErr.message }, { status: 400 });
    }

    // Ensure wallet exists
    await admin.from("tsb_wallets").upsert(
      {
        profile_id: userId,
        balance: 0,
        locked: 0,
      },
      { onConflict: "profile_id" }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "PROVISION_FAILED", details: e?.message || String(e) }, { status: 500 });
  }
}
