import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserIdWithName } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { fetchCurrentLotteryEvent } from "@/lib/lottery/db";

export const dynamic = "force-dynamic";

// Winner payout info (PI/VOUCHER): user submits contact details so admin can pay manually.
// PITD payouts are auto and do not need this.

export async function GET(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  const sb = getSupabaseAdminClient();

  try {
    const auth = await getAuthenticatedUserIdWithName(req);
    const masterUserId = await resolveMasterUserId(sb, auth.userId);
    const ev = await fetchCurrentLotteryEvent();
    if (!ev) return NextResponse.json({ ok: true, request: null });

    const { data } = await sb
      .from("lottery_payout_requests")
      .select("id,event_id,rank,full_name,phone,note,status,created_at,updated_at")
      .eq("event_id", ev.id)
      .eq("user_id", masterUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ ok: true, request: data || null, dbg: dbg ? { event_id: ev.id } : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "PAYOUT_REQ_GET_ERROR" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  const sb = getSupabaseAdminClient();

  try {
    const auth = await getAuthenticatedUserIdWithName(req);
    const masterUserId = await resolveMasterUserId(sb, auth.userId);
    const ev = await fetchCurrentLotteryEvent();
    if (!ev) return NextResponse.json({ ok: false, error: "NO_EVENT" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const rank = Number(body?.rank);
    const full_name = String(body?.full_name || "").trim();
    const phone = String(body?.phone || "").trim();
    const note = String(body?.note || "").trim();

    if (!Number.isFinite(rank) || rank <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_RANK" }, { status: 400 });
    }
    if (!full_name || !phone) {
      return NextResponse.json({ ok: false, error: "MISSING_CONTACT" }, { status: 400 });
    }

    // Must be a winner of this event
    const { data: winner } = await sb
      .from("lottery_winners")
      .select("id,rank,prize_type,payout_status")
      .eq("event_id", ev.id)
      .eq("user_id", masterUserId)
      .eq("rank", rank)
      .maybeSingle();

    if (!winner) {
      return NextResponse.json({ ok: false, error: "NOT_A_WINNER" }, { status: 403 });
    }
    if (winner.prize_type === "PITD") {
      return NextResponse.json({ ok: false, error: "PITD_NO_CONTACT_REQUIRED" }, { status: 400 });
    }

    const { data: saved, error } = await sb
      .from("lottery_payout_requests")
      .upsert(
        {
          event_id: ev.id,
          user_id: masterUserId,
          rank,
          full_name,
          phone,
          note,
          status: "submitted",
        },
        { onConflict: "event_id,user_id,rank" }
      )
      .select("id,event_id,rank,full_name,phone,note,status,created_at,updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "SAVE_FAILED" }, { status: 500 });
    }

    // Mark winner as pending payout if currently pending_contact
    await sb
      .from("lottery_winners")
      .update({ payout_status: "pending_payout", updated_at: new Date().toISOString() })
      .eq("event_id", ev.id)
      .eq("user_id", masterUserId)
      .eq("rank", rank)
      .eq("payout_status", "pending_contact");

    return NextResponse.json({ ok: true, request: saved, dbg: dbg ? { event_id: ev.id } : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "PAYOUT_REQ_POST_ERROR" }, { status: 500 });
  }
}
