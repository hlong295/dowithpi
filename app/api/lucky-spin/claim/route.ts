export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

function jsonOk(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function jsonErr(status: number, error: string, extra?: any) {
  return NextResponse.json({ ok: false, error, ...(extra ? { extra } : {}) }, { status });
}

export async function POST(req: Request) {
  const requesterId = await getAuthenticatedUserId(req);
  if (!requesterId) return jsonErr(401, "UNAUTHORIZED");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const logId = String(body?.log_id || body?.logId || "").trim();
  if (!logId) return jsonErr(400, "MISSING_LOG_ID");

  // Keep it minimal (Pi Browser screenshots): name/phone/note
  const fullName = String(body?.full_name || body?.fullName || "").trim();
  const phone = String(body?.phone || "").trim();
  const note = String(body?.note || "").trim();

  const claimInfo = {
    full_name: fullName || null,
    phone: phone || null,
    note: note || null,
    submitted_at: new Date().toISOString(),
  };

  const admin = getSupabaseAdminClient();

  // Ensure the log belongs to this user
  const { data: existing, error: readErr } = await admin
    .from("spin_logs")
    .select("id,user_id,status,reward_snapshot")
    .eq("id", logId)
    .maybeSingle();
  if (readErr) return jsonErr(500, "CLAIM_READ_ERROR", { message: readErr.message });
  if (!existing?.id) return jsonErr(404, "LOG_NOT_FOUND");
  if (String((existing as any).user_id) !== requesterId) return jsonErr(403, "FORBIDDEN");

  // Only allow claim for pending_contact logs
  const status = String((existing as any).status || "");
  if (status !== "pending_contact") {
    return jsonErr(400, "NOT_CLAIMABLE", { status });
  }

  const { data: updated, error: upErr } = await admin
    .from("spin_logs")
    .update({ claim_info: claimInfo })
    .eq("id", logId)
    .select("*")
    .maybeSingle();
  if (upErr) return jsonErr(500, "CLAIM_UPDATE_ERROR", { message: upErr.message });

  return jsonOk({ saved: true, log: updated });
}
