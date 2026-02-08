import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

export async function GET(req: Request) {
  try {
    const { user } = await getUserFromBearer(req);
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = getSupabaseAdmin();

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, username, role, level, full_name, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: "DB_ERROR", detail: pErr.message }, { status: 500 });
    }

    const { data: wallet, error: wErr } = await admin
      .from("tsb_wallets")
      .select("id, profile_id, balance, locked, created_at, updated_at")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (wErr) {
      return NextResponse.json({ error: "DB_ERROR", detail: wErr.message }, { status: 500 });
    }

    // IMPORTANT: Keep response backward-compatible with the client AuthContext.
    // AuthContext expects `{ user: { id, email, username, role, level, emailVerified, wallet } }`.
    // We also include `auth/profile/wallet` for debugging.
    const username =
      profile?.username ||
      ((user as any)?.user_metadata?.username as string | undefined) ||
      (user.email ? user.email.split("@")[0] : undefined) ||
      undefined;

    const userPayload = {
      id: user.id,
      email: user.email || "",
      username,
      role: profile?.role || "member",
      level: profile?.level ?? null,
      full_name: profile?.full_name || null,
      emailVerified: !!(user as any).email_confirmed_at,
      createdAt: profile?.created_at || null,
      updatedAt: profile?.updated_at || null,
      wallet: wallet
        ? {
            balance: Number((wallet as any).balance ?? 0),
            locked: Number((wallet as any).locked ?? 0),
          }
        : null,
    };

    return NextResponse.json({
      user: userPayload,
      auth: {
        id: user.id,
        email: user.email,
        email_confirmed_at: (user as any).email_confirmed_at || null,
      },
      profile: profile || null,
      wallet: wallet || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "ME_FAILED", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
