import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PrizeInput = {
  rank: number;
  prize_type: "PI" | "PITD" | "VOUCHER";
  amount: number;
  label?: string;
  is_active?: boolean;
};

// Admin upsert event + prizes (used by /lucky-spin admin panel)
export async function POST(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  const sb = getSupabaseAdminClient();

  try {
    const auth = await requireAdminUser(req);
    const adminMasterUserId = await resolveMasterUserId(sb, auth.userId);

    const body = await req.json().catch(() => ({}));
    const event = body?.event || {};
    const prizes: PrizeInput[] = Array.isArray(body?.prizes) ? body.prizes : [];

    const title = String(event?.title || "").trim() || "Xổ số may mắn";
    const description = String(event?.description || "").trim();

    const open_at = event?.open_at ? new Date(event.open_at).toISOString() : null;
    const close_at = event?.close_at ? new Date(event.close_at).toISOString() : null;
    const draw_at = event?.draw_at ? new Date(event.draw_at).toISOString() : null;

    const max_participants = Number(event?.max_participants || 0) || null;
    const close_when_full = Boolean(event?.close_when_full);
    const status = String(event?.status || "draft");

    // Hard rule: if any prize is PI, requires_pioneer must be true
    const hasPiPrize = prizes.some((p) => String(p?.prize_type).toUpperCase() === "PI");
    const requires_pioneer = Boolean(event?.requires_pioneer) || hasPiPrize;

    const payload: any = {
      id: event?.id || undefined,
      title,
      description: description || null,
      open_at,
      close_at,
      draw_at,
      max_participants,
      close_when_full,
      status,
      requires_pioneer,
      updated_at: new Date().toISOString(),
      meta: event?.meta || null,
    };

    // Upsert event
    const { data: savedEvent, error: evErr } = await sb
      .from("lottery_events")
      .upsert(payload)
      .select("id,title,description,open_at,close_at,draw_at,max_participants,close_when_full,status,requires_pioneer,created_at,updated_at,meta")
      .maybeSingle();

    if (evErr || !savedEvent) {
      return NextResponse.json({ ok: false, error: evErr?.message || "SAVE_EVENT_FAILED" }, { status: 500 });
    }

    // Upsert prizes
    const normalizedPrizes = prizes
      .filter((p) => Number.isFinite(Number(p?.rank)) && Number(p.rank) > 0)
      .map((p) => {
        const rank = Number(p.rank);
        const prize_type = String(p.prize_type || "PITD").toUpperCase();
        const amount = Number(p.amount || 0);
        return {
          event_id: savedEvent.id,
          rank,
          prize_type,
          amount,
          label: (p.label ? String(p.label) : `Hạng ${rank}`) as string,
          is_active: p.is_active !== false,
          updated_at: new Date().toISOString(),
        };
      });

    if (normalizedPrizes.length > 0) {
      const { error: prErr } = await sb.from("lottery_prizes").upsert(normalizedPrizes, { onConflict: "event_id,rank" });
      if (prErr) {
        return NextResponse.json({ ok: false, error: prErr.message || "SAVE_PRIZES_FAILED" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      event: savedEvent,
      dbg: dbg ? { adminMasterUserId, adminAuthKind: auth.authKind } : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "UNAUTHORIZED" }, { status: 401 });
  }
}
