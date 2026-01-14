import { NextResponse } from "next/server";
import { getAuthenticatedUserIdWithName } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { inferAuthKind } from "@/lib/lottery/auth";
import { fetchCurrentLotteryEvent } from "@/lib/lottery/db";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const dbg = new URL(req.url).searchParams.get("dbg") === "1";
  const sb = getSupabaseAdminClient();

  let requesterId: string;
  let requesterName: string | null;
  try {
    const auth = await getAuthenticatedUserIdWithName(req);
    requesterId = auth.userId;
    requesterName = auth.username;
  } catch {
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  const masterUserId = await resolveMasterUserId(sb, requesterId);
  const authKind = await inferAuthKind({
    requesterName,
    piUserIdHeader: req.headers.get("x-pi-user-id"),
    masterUserId,
  });

  const body = await req.json().catch(() => ({}));
  const eventId: string | undefined = body?.event_id;
  const chosenNumber = Number(body?.chosen_number);
  const idemKey = String(body?.idempotency_key || req.headers.get("x-idempotency-key") || "").trim();

  if (!eventId) return json(400, { ok: false, error: "MISSING_EVENT_ID" });
  if (!Number.isInteger(chosenNumber) || chosenNumber < 0 || chosenNumber > 9999)
    return json(400, { ok: false, error: "INVALID_NUMBER" });
  if (idemKey && idemKey.length > 128) return json(400, { ok: false, error: "INVALID_IDEMPOTENCY_KEY" });

  // Rate limit (DB-based) - best-effort
  try {
    await sb.from("lottery_api_requests").insert({ user_id: masterUserId, route: "register" });
    const { count } = await sb
      .from("lottery_api_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", masterUserId)
      .eq("route", "register")
      .gte("created_at", new Date(Date.now() - 10_000).toISOString());
    if ((count || 0) > 5) return json(429, { ok: false, error: "RATE_LIMIT" });
  } catch {
    // ignore
  }

  // Validate event + eligibility
  const { data: ev, error: evErr } = await sb
    .from("lottery_events")
    .select("id,status,requires_pioneer,close_when_full,max_participants,close_at")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr) return json(500, { ok: false, error: evErr.message });
  if (!ev) return json(404, { ok: false, error: "EVENT_NOT_FOUND" });

  if (ev.requires_pioneer && authKind !== "pi") {
    return json(403, {
      ok: false,
      error: "PIONEER_REQUIRED",
      message:
        "⚠️ Chương trình này có giải thưởng bằng Pi. Bạn đang đăng nhập bằng tài khoản Email nên không thể tham gia. 👉 Vui lòng đăng nhập bằng tài khoản Pi (Pioneer) để tham gia chương trình này.",
    });
  }

  if (ev.status !== "open") return json(400, { ok: false, error: "EVENT_NOT_OPEN" });
  if (ev.close_at && new Date(ev.close_at).getTime() <= Date.now()) {
    return json(400, { ok: false, error: "EVENT_CLOSED" });
  }

  // Close when full (optional)
  if (ev.close_when_full && ev.max_participants) {
    const { count } = await sb
      .from("lottery_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count || 0) >= ev.max_participants) return json(400, { ok: false, error: "EVENT_FULL" });
  }

  // Idempotency: if key exists for this user+event, return existing entry
  if (idemKey) {
    const { data: existingByKey } = await sb
      .from("lottery_entries")
      .select("id,chosen_number,created_at")
      .eq("event_id", eventId)
      .eq("user_id", masterUserId)
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existingByKey) {
      return json(200, { ok: true, entry: existingByKey, idempotent: true, dbg: dbg ? { authKind } : undefined });
    }
  }

  // Enforce 1 number/user + unique number/event
  try {
    const { data, error } = await sb
      .from("lottery_entries")
      .insert({
        event_id: eventId,
        user_id: masterUserId,
        chosen_number: chosenNumber,
        idempotency_key: idemKey || null,
      })
      .select("id,chosen_number,created_at")
      .single();

    if (error) {
      const msg = (error as any)?.message || "REGISTER_FAILED";
      // Supabase/Postgres unique violations
      if (msg.includes("lottery_entries_event_id_chosen_number_key") || msg.toLowerCase().includes("duplicate key")) {
        return json(409, { ok: false, error: "NUMBER_TAKEN", message: "Số đã có người chọn" });
      }
      if (msg.includes("lottery_entries_event_id_user_id_key")) {
        // already registered
        const { data: existing } = await sb
          .from("lottery_entries")
          .select("id,chosen_number,created_at")
          .eq("event_id", eventId)
          .eq("user_id", masterUserId)
          .maybeSingle();
        return json(200, { ok: true, entry: existing, already: true });
      }
      return json(500, { ok: false, error: msg });
    }

    return json(200, { ok: true, entry: data, dbg: dbg ? { authKind } : undefined });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "REGISTER_ERROR" });
  }
}
