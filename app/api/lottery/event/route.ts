import { NextResponse } from "next/server";

import {
  fetchCurrentLotteryEvent,
  fetchEventParticipantCount,
  fetchEventPrizes,
  fetchMyEntry,
} from "@/lib/lottery/db";

/**
 * Public endpoint: fetch current/open lottery event + prizes + participant count.
 *
 * Must return JSON in ALL cases (avoid HTML error pages that break JSON.parse).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get("requesterId") || null;

    const event = await fetchCurrentLotteryEvent();
    if (!event) {
      return NextResponse.json({ ok: true, event: null }, { status: 200 });
    }

    const [prizes, participantCount] = await Promise.all([
      fetchEventPrizes(event.id),
      fetchEventParticipantCount(event.id),
    ]);

    // If requesterId is available, try to fetch their registered number.
    // No hard dependency: if it fails, we still return event data.
    let myEntry: any = null;
    if (requesterId) {
      try {
        myEntry = await fetchMyEntry(event.id, requesterId);
      } catch {
        myEntry = null;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        event,
        prizes,
        participantCount,
        myEntry,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const message = err?.message || "Internal server error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
