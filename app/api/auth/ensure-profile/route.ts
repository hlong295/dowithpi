import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

// Ensure: auth.user -> profiles -> identities(provider=email) -> tsb_wallets.
// Uses Bearer access token to identify the user, then provisions using service role.

export async function POST(req: Request) {
  try {
    const { user } = await getUserFromBearer(req);
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const requestedUsername = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";

    // Email-only provisioning here.
    const email = (user.email || "").toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "MISSING_EMAIL" }, { status: 400 });
    }

    // Root lock (email primary)
    const ROOT_EMAIL = "dowithpi@gmail.com";
    const ROOT_USERNAME = "hlong295";
    const isRootEmail = email === ROOT_EMAIL;

    // If caller passed username, enforce namespace rule.
    if (requestedUsername && requestedUsername.startsWith("pi_")) {
      return NextResponse.json({ error: "USERNAME_PI_NAMESPACE" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1) Upsert profiles(id = auth.users.id)
    // Prefer existing DB username; set only if empty.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, username, role")
      .eq("id", user.id)
      .maybeSingle();

    const usernameToSet = (() => {
      // Root must keep namespace locked
      if (isRootEmail) return ROOT_USERNAME;
      if (existingProfile?.username) return existingProfile.username;
      if (requestedUsername) return requestedUsername;
      // Fallback: derive from email local-part (safe, lowercase)
      const local = email.split("@")[0] || "user";
      return local.toLowerCase();
    })();

    const roleToSet = (() => {
      // Root is always root_admin (never downgrade here)
      if (isRootEmail) return "root_admin";
      // Preserve existing role if present; otherwise default member
      return (existingProfile?.role as any) || "member";
    })();

    // Insert if missing, else update username if null.
    if (!existingProfile?.id) {
      const { error: insErr } = await admin.from("profiles").insert({
        id: user.id,
        username: usernameToSet,
        role: roleToSet,
      });
      if (insErr) {
        return NextResponse.json({ error: "PROFILE_UPSERT_FAILED", detail: insErr.message }, { status: 500 });
      }
    } else {
      // Update username if missing OR (root) mismatched
      const needsUsernameUpdate = !existingProfile.username || (isRootEmail && existingProfile.username !== ROOT_USERNAME);
      const needsRoleUpdate = isRootEmail && existingProfile.role !== "root_admin";

      if (needsUsernameUpdate || needsRoleUpdate) {
        const updatePayload: any = {};
        if (needsUsernameUpdate) updatePayload.username = usernameToSet;
        if (needsRoleUpdate) updatePayload.role = "root_admin";
        const { error: updErr } = await admin.from("profiles").update(updatePayload).eq("id", user.id);
        if (updErr) {
          return NextResponse.json({ error: "PROFILE_UPDATE_FAILED", detail: updErr.message }, { status: 500 });
        }
      }
    }

    // 2) Ensure identities(provider=email)
    const { data: emailIdent } = await admin
      .from("identities")
      .select("id")
      .eq("profile_id", user.id)
      .eq("provider", "email")
      .maybeSingle();

    if (!emailIdent?.id) {
      const { error: identErr } = await admin.from("identities").insert({
        profile_id: user.id,
        provider: "email",
        provider_uid: email,
      });
      if (identErr) {
        return NextResponse.json({ error: "IDENTITY_CREATE_FAILED", detail: identErr.message }, { status: 500 });
      }
    }

    // 3) Ensure tsb_wallets
    const { data: wallet } = await admin
      .from("tsb_wallets")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!wallet?.id) {
      const { error: wErr } = await admin.from("tsb_wallets").insert({
        profile_id: user.id,
        balance: 0,
        locked: 0,
      });
      if (wErr) {
        return NextResponse.json({ error: "WALLET_CREATE_FAILED", detail: wErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, user_id: user.id, email, username: usernameToSet });
  } catch (e: any) {
    return NextResponse.json(
      { error: "ENSURE_PROFILE_FAILED", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
