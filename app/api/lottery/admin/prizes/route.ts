import { NextResponse } from "next/server";

import { getUserFromRequest, isRootAdmin } from "@/lib/lottery/auth";
import { getLotterySupabaseAdmin } from "@/lib/lottery/db";

type PrizeInput = {
  rank?: number;
  amount?: number;
  currency?: string;
  label?: string;
};

export const dynamic = "force-dynamic";

// Save prizes for a lottery event (root admin only).
// This is intentionally server-only and uses the admin client (service role) behind the API.
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !isRootAdmin(user.piUsername)) {
      return NextResponse.json(
        {
          ok: false,
          error: "FORBIDDEN",
          debug: {
            piUsername: user?.piUsername || null,
            userId: user?.id || null,
          },
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const eventId: string | null = body?.event_id || body?.eventId || null;
    const prizes: PrizeInput[] = Array.isArray(body?.prizes) ? body.prizes : [];

    if (!eventId) {
      return NextResponse.json({ ok: false, error: "MISSING_EVENT_ID" }, { status: 400 });
    }

    const admin = getLotterySupabaseAdmin();

    // Replace all prizes for this event.
    const delRes = await admin.from("lottery_prizes").delete().eq("event_id", eventId);
    if (delRes.error) {
      return NextResponse.json(
        { ok: false, error: "DB_DELETE_FAILED", details: delRes.error.message },
        { status: 500 }
      );
    }

    const rows = prizes
      .map((p, idx) => {
        const rank = Number.isFinite(p.rank as number) ? Number(p.rank) : idx + 1;
        const amount = Number.isFinite(p.amount as number) ? Number(p.amount) : 0;
        const currency = String(p.currency || p.label || "PITD").trim();
        return { event_id: eventId, rank, amount, currency };
      })
      .filter((r) => r.rank > 0);

    if (rows.length > 0) {
      const insRes = await admin.from("lottery_prizes").insert(rows);
      if (insRes.error) {
        return NextResponse.json(
          { ok: false, error: "DB_INSERT_FAILED", details: insRes.error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
