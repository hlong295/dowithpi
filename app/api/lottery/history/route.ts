import { NextResponse } from "next/server";

import { fetchHistoryForEvent } from "@/lib/lottery/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_EVENT_ID" },
        { status: 400 }
      );
    }

    const items = await fetchHistoryForEvent(eventId);
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "LOTTERY_HISTORY_FAILED",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
