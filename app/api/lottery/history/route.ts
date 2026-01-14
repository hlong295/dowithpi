import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchCurrentLotteryEvent } from "@/lib/lottery/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public endpoint: show results of the latest event (or active event if completed)
// Returns shape expected by /lucky-spin page:
// { ok, ranks: [{ rank, label, prize_type, amount, numbers: string[] }] }
export async function GET(req: Request) {
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
    const ev = await fetchCurrentLotteryEvent();
    if (!ev) return NextResponse.json({ ok: true, ranks: [], dbg: dbg ? { note: "NO_EVENT" } : undefined });

    const { data: prizes } = await sb
      .from("lottery_prizes")
      .select("rank,prize_type,amount,label,is_active")
      .eq("event_id", ev.id)
      .eq("is_active", true)
      .order("rank", { ascending: true });

    const { data: winners } = await sb
      .from("lottery_winners")
      .select("rank,chosen_number")
      .eq("event_id", ev.id)
      .order("rank", { ascending: true })
      .order("chosen_number", { ascending: true });

    const byRank = new Map<number, string[]>();
    for (const w of winners || []) {
      const r = Number(w.rank);
      const n = String(w.chosen_number).padStart(5, "0");
      const arr = byRank.get(r) || [];
      arr.push(n);
      byRank.set(r, arr);
    }

    const ranks = (prizes || []).map((p: any) => {
      const r = Number(p.rank);
      return {
        rank: r,
        label: p.label || `Hạng ${r}`,
        prize_type: p.prize_type,
        amount: p.amount,
        numbers: byRank.get(r) || [],
      };
    });

    return NextResponse.json({ ok: true, ranks, dbg: dbg ? { event_id: ev.id } : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "LOTTERY_HISTORY_ERROR" }, { status: 500 });
  }
}
