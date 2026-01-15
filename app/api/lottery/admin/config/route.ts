import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { ROOT_ADMIN_USERNAME } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

function isRootAdminFromHeaders(req: Request) {
  const u = req.headers.get("x-pi-username") || req.headers.get("x-username") || "";
  return u && u.toLowerCase() === String(ROOT_ADMIN_USERNAME).toLowerCase();
}

export async function POST(req: Request) {
  try {
    if (!isRootAdminFromHeaders(req)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as any;
    const event = body?.event;
    const prizes = Array.isArray(body?.prizes) ? body.prizes : [];

    if (!event?.id) {
      return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Update event
    const { error: evErr } = await supabase
      .from("lottery_events")
      .update({
        title: event.title,
        open_at: event.open_at,
        close_at: event.close_at,
        draw_at: event.draw_at,
        close_when_reach_limit: !!event.close_when_reach_limit,
        max_registrations: event.max_registrations ?? null,
        reward_currency: event.reward_currency ?? "PITD",
        status: event.status ?? "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    if (evErr) {
      return NextResponse.json({ error: "EVENT_UPDATE_FAILED", details: evErr.message }, { status: 500 });
    }

    // Update prizes (upsert by id if provided, else insert new)
    for (const p of prizes) {
      if (!p) continue;
      const row = {
        id: p.id,
        event_id: event.id,
        tier: p.tier,
        name: p.name,
        reward_amount: p.reward_amount,
        reward_currency: p.reward_currency ?? event.reward_currency ?? "PITD",
        quantity: p.quantity,
        created_at: p.created_at,
        updated_at: new Date().toISOString(),
      };

      if (row.id) {
        const { error } = await supabase.from("lottery_prizes").update(row).eq("id", row.id);
        if (error) {
          return NextResponse.json({ error: "PRIZE_UPDATE_FAILED", details: error.message }, { status: 500 });
        }
      } else {
        const { error } = await supabase.from("lottery_prizes").insert({ ...row, id: undefined });
        if (error) {
          return NextResponse.json({ error: "PRIZE_INSERT_FAILED", details: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL", message: e?.message || String(e) }, { status: 500 });
  }
}
