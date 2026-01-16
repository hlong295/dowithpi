import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
// IMPORTANT: Use Node.js runtime for compatibility with supabase-js in Pi App Studio / Vercel.
// Edge runtime can cause unexpected 500s depending on platform limitations.
export const runtime = "nodejs";


type LotteryEventRow = {
  id: string;
  title: string;
  description: string | null;
  open_at: string;
  close_at: string;
  draw_at: string;
  status: "draft" | "open" | "closed" | "drawn" | string;
  reward_currency: "Pi" | "PITD" | string;
  max_participants: number | null;
  close_when_full: boolean;
  requires_pioneer: boolean;
};

type PrizeRow = {
  rank: number;
  prize_type: "Pi" | "PITD" | string;
  amount: number;
  label: string;
};

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Some DB setups use `timestamp without time zone` for lottery_events.*_at.
// In that case Supabase returns strings like "2026-01-16T11:07:00" (no Z/offset).
// On Vercel (UTC servers) `new Date(noOffset)` is interpreted as UTC, which would shift
// Vietnam local time by -7h and incorrectly mark events as closed.
// To be robust across both `timestamptz` and `timestamp` columns, treat NO-OFFSET strings
// as Asia/Ho_Chi_Minh (+07:00).
function parseEventTimeMs(v: any): number {
  if (!v) return NaN;
  const s = String(v);
  const hasTz = /[zZ]$/.test(s) || /[+-]\d\d:\d\d$/.test(s);
  const d = new Date(hasTz ? s : `${s}+07:00`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : NaN;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dbg = url.searchParams.get("dbg") === "1";

  try {
    // Prefer service-role (server secrets). If unavailable (PiNet/App Studio), fallback to anon read.
    let admin: any = null;
    let sb: any;
    try {
      admin = getSupabaseAdminClient();
      sb = admin;
    } catch {
      // Read-only fallback
      sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // 1) Find newest active-ish event
    const { data: event, error: evErr } = await sb
      .from("lottery_events")
      // Use "*" to avoid hard-failing when columns evolve (e.g., reward_currency migration timing).
      .select("*")
      .in("status", ["open", "draft", "closed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (evErr) {
      return NextResponse.json(
        {
          ok: false,
          code: "LOTTERY_EVENT_FETCH_FAILED",
          message: evErr.message,
          ...(dbg ? { dbg: { hint: "Check table lottery_events and service role permissions" } } : {}),
        },
        { status: 500 }
      );
    }

    let current = event as LotteryEventRow | null;

    // 2) Auto-create a default draft event if none exists (keeps UI alive)
    if (!current) {
      // If we don't have admin/service-role, we cannot create a default event.
      if (!admin) {
        return NextResponse.json(
          {
            ok: true,
            event: null,
            prizes: [],
            participants_count: 0,
            message: "NO_EVENT",
            ...(dbg ? { dbg: { note: "No lottery_events rows found; service role not available to auto-create." } } : {}),
          },
          { status: 200 }
        );
      }
      const now = new Date();
      const openAt = new Date(now.getTime() - 60 * 1000);
      const closeAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const drawAt = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000);

      const { data: created, error: cErr } = await admin
        .from("lottery_events")
        .insert({
          title: "Xổ số may mắn",
          description: "Sự kiện quay số trúng thưởng",
          open_at: openAt.toISOString(),
          close_at: closeAt.toISOString(),
          draw_at: drawAt.toISOString(),
          status: "draft",
          reward_currency: "PITD",
          max_participants: 500,
          close_when_full: true,
          requires_pioneer: false,
        })
        .select("*")
        .single();

      if (cErr) {
        return NextResponse.json(
          {
            ok: false,
            code: "LOTTERY_EVENT_CREATE_FAILED",
            message: cErr.message,
            ...(dbg ? { dbg: { hint: "Check SQL schema in supabase/LOTTERY_FULL.sql" } } : {}),
          },
          { status: 500 }
        );
      }

      current = created as LotteryEventRow;

      // Default prizes (rank 1..3)
      await admin.from("lottery_prizes").insert([
        { event_id: current.id, rank: 1, prize_type: "PITD", amount: 10, label: "Hạng 1" },
        { event_id: current.id, rank: 2, prize_type: "PITD", amount: 5, label: "Hạng 2" },
        { event_id: current.id, rank: 3, prize_type: "PITD", amount: 2, label: "Hạng 3" },
      ]);
    }

    // 3) Prizes
    const { data: prizes, error: pErr } = await sb
      .from("lottery_prizes")
      .select("id,rank,prize_type,amount,label")
      .eq("event_id", current.id)
      .order("rank", { ascending: true });

    if (pErr) {
      return NextResponse.json(
        { ok: false, code: "LOTTERY_PRIZES_FETCH_FAILED", message: pErr.message },
        { status: 500 }
      );
    }

    // 4) Count registrations
    const { count, error: cntErr } = await sb
      .from("lottery_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", current.id);

    if (cntErr) {
      return NextResponse.json(
        { ok: false, code: "LOTTERY_ENTRIES_COUNT_FAILED", message: cntErr.message },
        { status: 500 }
      );
    }

    // Compute a derived status from time window (robust across tz differences).
    // This keeps banner badge + register button consistent, even if admin forgot to update `status`.
    const nowMs = Date.now();
    const openMs = parseEventTimeMs((current as any).open_at);
    const closeMs = parseEventTimeMs((current as any).close_at);
    let derivedStatus = String((current as any).status || "").toLowerCase();
    if (Number.isFinite(openMs) && Number.isFinite(closeMs)) {
      if (nowMs < openMs) derivedStatus = "draft";
      else if (nowMs >= closeMs) derivedStatus = "closed";
      else derivedStatus = "open";
    }

    // IMPORTANT: The LuckySpin UI expects snake_case keys to match DB columns.
    // Keep the response contract stable (do NOT camelCase) to avoid client-side breakage.
    const eventOut = {
      id: current.id,
      title: current.title,
      description: current.description ?? null,
      open_at: current.open_at,
      close_at: current.close_at,
      draw_at: current.draw_at,
      max_participants: current.max_participants,
      close_when_full: !!current.close_when_full,
      // Use derived status to avoid showing "ĐANG ĐĂNG KÝ" while API blocks registration.
      status: derivedStatus,
      requires_pioneer: !!current.requires_pioneer,
      reward_currency: current.reward_currency,
      // keep a meta bag for forward-compat
      meta: {},
    };

    const prizesOut = (prizes ?? []).map((p: any) => ({
      id: p.id ?? `${current.id}:${p.rank}`,
      rank: p.rank,
      prize_type: p.prize_type,
      amount: toNumber(p.amount),
      label: p.label,
    }));

    // Eligibility is required for enabling the “ĐĂNG KÝ SỐ” button.
    // We align eligibility with the derived time-based status.
    const isOpen = derivedStatus === "open";
    let ineligible_reason: string | null = null;
    if (!isOpen) {
      if (derivedStatus === "draft") ineligible_reason = "EVENT_NOT_STARTED";
      else ineligible_reason = "EVENT_CLOSED";
    }
    const eligible = isOpen;

    return NextResponse.json({
      ok: true,
      event: eventOut,
      prizes: prizesOut,
      stats: { participants: count ?? 0, max_participants: current.max_participants },
      my_entry: null,
      my_win: null,
      my_payout_request: null,
      eligible,
      ineligible_reason,
      ...(dbg ? { debug: { usingAdmin: Boolean(admin), participants: count ?? 0 } } : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOTTERY_EVENT_INTERNAL_ERROR",
        message: e?.message || "Internal error",
        ...(dbg ? { dbg: { stack: String(e?.stack || "") } } : {}),
      },
      { status: 500 }
    );
  }
}
