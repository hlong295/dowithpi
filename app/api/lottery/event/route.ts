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
      status: current.status,
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
    // We keep it permissive and let /api/lottery/register enforce pioneer-only rules.
    const isOpen = String(current.status || "").toLowerCase() === "open";
    const eligible = isOpen;
    const ineligible_reason = isOpen ? null : "EVENT_NOT_OPEN";

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
