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

function parseDateInputToISO(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // Accept datetime-local format reliably across browsers: YYYY-MM-DDTHH:MM
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) {
      const yyyy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      const hh = Number(m[4]);
      const mi = Number(m[5]);
      const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Some browsers may emit "YYYY-MM-DD HH:MM" (space instead of T)
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (m2) {
      const yyyy = Number(m2[1]);
      const mm = Number(m2[2]);
      const dd = Number(m2[3]);
      const hh = Number(m2[4]);
      const mi = Number(m2[5]);
      const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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

    // Accept multiple key variants from client
    const open_at = parseDateInputToISO(event?.open_at ?? event?.openAt ?? event?.open_at_iso);
    const close_at = parseDateInputToISO(event?.close_at ?? event?.closeAt ?? event?.close_at_iso);
    const draw_at = parseDateInputToISO(event?.draw_at ?? event?.drawAt ?? event?.draw_at_iso);

    if (!open_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_OPEN_AT",
          dbg: dbg ? { received_open_at: event?.open_at, keys: Object.keys(event || {}) } : undefined,
        },
        { status: 400 }
      );
    }
    if (!close_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_CLOSE_AT",
          dbg: dbg ? { received_close_at: event?.close_at, keys: Object.keys(event || {}) } : undefined,
        },
        { status: 400 }
      );
    }
    if (!draw_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_DRAW_AT",
          dbg: dbg ? { received_draw_at: event?.draw_at, keys: Object.keys(event || {}) } : undefined,
        },
        { status: 400 }
      );
    }

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
