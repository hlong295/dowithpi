import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromBearer } from "@/lib/supabase/server-auth";

export async function GET(req: Request) {
  const { user } = await getUserFromBearer(req);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const admin = getSupabaseAdmin();
  const { data: wallet } = await admin.from("tsb_wallets").select("id").eq("profile_id", user.id).maybeSingle();
  if (!wallet?.id) return NextResponse.json({ ok: true, items: [] });

  const { data, error } = await admin
    .from("tsb_transactions")
    .select("id, wallet_id, type, amount, balance_after, reference_type, reference_id, metadata, created_at")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "LEDGER_READ_FAILED", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data || [] });
}
