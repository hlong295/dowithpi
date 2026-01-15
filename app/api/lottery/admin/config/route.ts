import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/lottery/auth";

export const dynamic = "force-dynamic";

function isRootAdmin(user: any): boolean {
  const username = (user?.username || user?.pi_username || "").toString().toLowerCase();
  const role = (user?.role || user?.user_role || "").toString().toLowerCase();
  return role === "root_admin" || username === "hlong295";
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !isRootAdmin(user)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const eventId = String(body?.eventId || "");
    if (!eventId) {
      return NextResponse.json({ ok: false, error: "MISSING_EVENT_ID" }, { status: 400 });
    }

    // NOTE: Keep schema aligned with supabase/LOTTERY_FULL.sql
    const patch: Record<string, any> = {};
    if (typeof body?.title === "string") patch.title = body.title;
    if (typeof body?.description === "string") patch.description = body.description;
    if (typeof body?.openAt === "string") patch.open_at = body.openAt;
    if (typeof body?.closeAt === "string") patch.close_at = body.closeAt;
    if (typeof body?.drawAt === "string") patch.draw_at = body.drawAt;
    if (typeof body?.status === "string") patch.status = body.status;
    if (typeof body?.rewardCurrency === "string") patch.reward_currency = body.rewardCurrency;
    if (typeof body?.maxParticipants === "number") patch.max_participants = body.maxParticipants;
    if (typeof body?.closeWhenFull === "boolean") patch.close_when_full = body.closeWhenFull;
    if (typeof body?.requiresPioneer === "boolean") patch.requires_pioneer = body.requiresPioneer;

    const supabase = getSupabaseAdminClient();

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase.from("lottery_events").update(patch).eq("id", eventId);
      if (updateErr) {
        // Defensive: if DB is missing newly added columns, retry without them.
        if (patch.reward_currency && /reward_currency/i.test(updateErr.message)) {
          const retryPatch = { ...patch };
          delete (retryPatch as any).reward_currency;
          const { error: retryErr } = await supabase.from("lottery_events").update(retryPatch).eq("id", eventId);
          if (retryErr) {
            return NextResponse.json({ ok: false, error: retryErr.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
        }
      }
    }

    // Replace prizes if provided.
    if (Array.isArray(body?.prizes)) {
      const prizes = body.prizes
        .map((p: any) => ({
          event_id: eventId,
          rank: Number(p?.rank),
          prize_type: String(p?.prizeType || p?.prize_type || "PITD"),
          amount: Number(p?.amount ?? 0),
          label: p?.label ? String(p.label) : null,
        }))
        .filter((p: any) => Number.isFinite(p.rank) && p.rank > 0);

      // Best-effort: clear then insert
      const { error: delErr } = await supabase.from("lottery_prizes").delete().eq("event_id", eventId);
      if (delErr) {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }
      if (prizes.length > 0) {
        const { error: insErr } = await supabase.from("lottery_prizes").insert(prizes);
        if (insErr) {
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "UNKNOWN" }, { status: 500 });
  }
}
