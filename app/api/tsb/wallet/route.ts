import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

export async function GET(req: Request) {
  const { user } = await getUserFromBearer(req);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Ensure wallet exists (defensive; DB trigger should handle it)
  await admin.from("tsb_wallets").upsert({ profile_id: user.id, balance: 0, locked: 0 }, { onConflict: "profile_id" });

  const { data, error } = await admin
    .from("tsb_wallets")
    .select("id, profile_id, balance, locked, created_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "WALLET_READ_FAILED", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, wallet: data || null });
}
