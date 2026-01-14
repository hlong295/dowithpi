import { NextResponse } from "next/server";
import { getAuthenticatedUserIdWithName } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchCurrentLotteryEvent } from "@/lib/lottery/db";
import { inferAuthKind } from "@/lib/lottery/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  const sb = getSupabaseAdminClient();

  // Allow guests to view event summary (no auth required).
  let requesterId: string | null = null;
  let requesterName: string | null = null;
  let masterUserId: string | null = null;
  let authKind: "pi" | "email" | null = null;

  try {
    const auth = await getAuthenticatedUserIdWithName(req);
    requesterId = auth.userId;
    requesterName = auth.username;
    masterUserId = await resolveMasterUserId(sb, requesterId);
    authKind = await inferAuthKind({
      requesterName,
      piUserIdHeader: req.headers.get("x-pi-user-id"),
      masterUserId,
    });
  } catch {
    // guest
  }

  try {
    const ev = await fetchCurrentLotteryEvent();
    if (!ev) {
      return NextResponse.json({
        ok: true,
        event: null,
        stats: null,
        prizes: [],
        my_entry: null,
        eligible: false,
        ineligible_reason: "NO_EVENT",
        auth_kind: authKind,
        dbg: dbg ? { requesterId, masterUserId, authKind } : undefined,
      });
    }

    // counts
    const { count: participantsCount } = await sb
      .from("lottery_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);

    let myEntry: any = null;
    if (masterUserId) {
      const { data } = await sb
        .from("lottery_entries")
        .select("id,chosen_number,created_at")
        .eq("event_id", ev.id)
        .eq("user_id", masterUserId)
        .maybeSingle();
      myEntry = data || null;
    }

    const { data: prizes } = await sb
      .from("lottery_prizes")
      .select("id,rank,prize_type,amount,label,is_active")
      .eq("event_id", ev.id)
      .eq("is_active", true)
      .order("rank", { ascending: true });

    // Eligibility rules
    // - Guests can view, but must login to register.
    // - Email users cannot join PI events (requires_pioneer = true).
    let eligible = false;
    let ineligible_reason: string | null = null;
    if (!masterUserId) {
      eligible = false;
      ineligible_reason = "LOGIN_REQUIRED";
    } else if (ev.requires_pioneer && authKind === "email") {
      eligible = false;
      ineligible_reason =
        "⚠️ Chương trình này có giải thưởng bằng Pi.\nBạn đang đăng nhập bằng tài khoản Email nên không thể tham gia.\n👉 Vui lòng đăng nhập bằng tài khoản Pi (Pioneer) để tham gia chương trình này.";
    } else {
      eligible = true;
      ineligible_reason = null;
    }

    return NextResponse.json({
      ok: true,
      event: ev,
      stats: {
        participants_count: participantsCount || 0,
        max_participants: ev.max_participants,
        close_when_full: ev.close_when_full,
      },
      prizes: prizes || [],
      my_entry: myEntry,
      eligible,
      ineligible_reason,
      auth_kind: authKind,
      dbg: dbg ? { requesterId, masterUserId, requesterName } : undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "LOTTERY_EVENT_ERROR",
        dbg: dbg ? { requesterId, masterUserId, authKind } : undefined,
      },
      { status: 500 }
    );
  }
}
