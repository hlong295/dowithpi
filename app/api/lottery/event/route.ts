import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type LotteryEventRow = {
  id: string;
  title: string;
  open_at: string;
  close_at: string;
  draw_at: string;
  close_when_reach_limit: boolean;
  max_registrations: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type LotteryPrizeRow = {
  id: string;
  event_id: string;
  rank: number;
  reward_amount: number;
  reward_currency: string;
  winners_count: number;
};

function nowPlus(minutes: number) {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toISOString();
}

async function ensureSeedEventAndPrizes() {
  const admin = getSupabaseAdminClient();

  // 1) Try get latest event (any status)
  const { data: existing, error: existingErr } = await admin
    .from("lottery_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingErr) {
    // Table missing or permission issue → bubble up; client will show debug.
    return { event: null as LotteryEventRow | null, prizes: [] as LotteryPrizeRow[], error: existingErr.message };
  }

  if (existing && existing.length > 0) {
    const event = existing[0] as LotteryEventRow;
    const { data: prizes } = await admin
      .from("lottery_prizes")
      .select("*")
      .eq("event_id", event.id)
      .order("rank", { ascending: true });
    return { event, prizes: (prizes || []) as LotteryPrizeRow[], error: null as string | null };
  }

  // 2) Seed a default event (safe for fresh DB)
  const open_at = nowPlus(-5);
  const close_at = nowPlus(60);
  const draw_at = nowPlus(90);

  const { data: created, error: createErr } = await admin
    .from("lottery_events")
    .insert({
      title: "Xổ số may mắn",
      open_at,
      close_at,
      draw_at,
      close_when_reach_limit: true,
      max_registrations: 500,
      status: "open",
    })
    .select("*")
    .single();

  if (createErr || !created) {
    return { event: null as LotteryEventRow | null, prizes: [] as LotteryPrizeRow[], error: createErr?.message || "CREATE_EVENT_FAILED" };
  }

  const event = created as LotteryEventRow;

  // 3) Seed default prizes (Hạng 1/2/3) as PITD
  const { data: createdPrizes, error: prizeErr } = await admin
    .from("lottery_prizes")
    .insert([
      { event_id: event.id, rank: 1, reward_amount: 100, reward_currency: "PITD", winners_count: 1 },
      { event_id: event.id, rank: 2, reward_amount: 50, reward_currency: "PITD", winners_count: 1 },
      { event_id: event.id, rank: 3, reward_amount: 10, reward_currency: "PITD", winners_count: 1 },
    ])
    .select("*");

  if (prizeErr) {
    // Event created, prizes failed → still return event.
    return { event, prizes: [] as LotteryPrizeRow[], error: prizeErr.message };
  }

  return { event, prizes: (createdPrizes || []) as LotteryPrizeRow[], error: null as string | null };
}

export async function GET() {
  try {
    const admin = getSupabaseAdminClient();

    const seeded = await ensureSeedEventAndPrizes();
    if (seeded.error) {
      return NextResponse.json(
        {
          event: seeded.event,
          prizes: seeded.prizes,
          error: "LOTTERY_EVENT_SEED_OR_READ_FAILED",
          details: seeded.error,
        },
        { status: seeded.event ? 200 : 500 }
      );
    }

    const event = seeded.event;
    const prizes = seeded.prizes;

    // Registration count (optional)
    let registeredCount: number | null = null;
    if (event?.id) {
      const { count } = await admin
        .from("lottery_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      registeredCount = typeof count === "number" ? count : null;
    }

    return NextResponse.json(
      {
        event,
        prizes,
        stats: {
          registeredCount,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        event: null,
        prizes: [],
        error: "INTERNAL_SERVER_ERROR",
        details: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}
