import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  let sb: ReturnType<typeof getSupabaseAdminClient>;
  try {
    sb = getSupabaseAdminClient();
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUPABASE_ADMIN_CLIENT_ERROR",
        message: e?.message || String(e),
        dbg: dbg ? { where: WHERE, raw: String(e) } : undefined,
      },
      { status: 500 }
    );
  }

  try {
    const auth = await requireAdminUser(req);
    const adminMasterUserId = await resolveMasterUserId(sb, auth.userId);

    const body = await req.json().catch(() => ({}));
    const event_id = String(body?.event_id || "");
    const user_id = String(body?.user_id || "");
    const rank = Number(body?.rank);

    if (!event_id || !user_id || !Number.isFinite(rank) || rank <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const { error } = await sb
      .from("lottery_winners")
      .update({ payout_status: "paid", paid_by: adminMasterUserId, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("event_id", event_id)
      .eq("user_id", user_id)
      .eq("rank", rank);

    if (error) return NextResponse.json({ ok: false, error: error.message || "UPDATE_FAILED" }, { status: 500 });
    return NextResponse.json({ ok: true, dbg: dbg ? { adminMasterUserId } : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "UNAUTHORIZED" }, { status: 401 });
  }
}
