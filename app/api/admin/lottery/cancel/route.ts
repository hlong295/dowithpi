import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/pitd/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Cancel the currently configured lottery event so admin can create a new one.
// We do NOT delete rows (audit). We simply set status = 'cancelled'.
export async function POST(req: Request) {
  try {
    const { userId } = await requireAdminUser(req);
    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.event_id || "").trim();

    if (!eventId) {
      return NextResponse.json({ ok: false, code: "MISSING_EVENT_ID" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("lottery_events")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", eventId);

    if (error) {
      return NextResponse.json({ ok: false, code: "CANCEL_FAILED", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cancelled: true, event_id: eventId, by: userId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED_OR_ERROR", message: e?.message || String(e) }, { status: 401 });
  }
}
