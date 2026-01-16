import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest, isRootAdmin, ROOT_ADMIN_USERNAME } from "@/lib/lottery/auth";

export const dynamic = "force-dynamic";

// IMPORTANT:
// - Admin enters dates via <input type="datetime-local">.
// - That value has NO timezone.
// - On Vercel, server timezone is often UTC, so `new Date(yyyy,mm,dd,hh,mi)` would interpret as UTC
//   and shift the stored timestamptz by +07 hours for Vietnam users.
// We must treat the input as Vietnam local time (+07:00) when converting to ISO.
const VN_TZ_OFFSET_MINUTES = 7 * 60;

function toIsoAssumingOffset(yyyy: number, mm: number, dd: number, hh: number, mi: number, offsetMinutes: number) {
  // Input represents local time at the given offset. Convert to UTC millis.
  const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, mi, 0, 0) - offsetMinutes * 60_000;
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseDateInputToISO(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // If the string already contains an explicit timezone (Z or +/-HH:MM), trust native parsing.
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Accept datetime-local format reliably across browsers: YYYY-MM-DDTHH:MM
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (m) {
      const yyyy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      const hh = Number(m[4]);
      const mi = Number(m[5]);
      return toIsoAssumingOffset(yyyy, mm, dd, hh, mi, VN_TZ_OFFSET_MINUTES);
    }

    // Accept common mobile/webview formats like: MM/DD/YYYY HH:MM or DD/MM/YYYY HH:MM
    // (some datetime-local pickers display/emit localized strings).
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,\s*|\s+)(\d{1,2}):(\d{2})/);
    if (m2) {
      const a = Number(m2[1]);
      const b = Number(m2[2]);
      let yyyy = Number(m2[3]);
      const hh = Number(m2[4]);
      const mi = Number(m2[5]);
      if (yyyy < 100) yyyy += 2000;

      // Heuristic: if first part > 12, treat as DD/MM; else treat as MM/DD.
      const dd = a > 12 ? a : b;
      const mm = a > 12 ? b : a;
      return toIsoAssumingOffset(yyyy, mm, dd, hh, mi, VN_TZ_OFFSET_MINUTES);
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    // Pi App Studio/Pi Browser sometimes loses auth cookies; allow root admin
    // if the request explicitly carries pi_username=ROOT_ADMIN_USERNAME.
    const headerUsername = (req.headers.get("x-pi-username") || "").trim().toLowerCase();
    let qpUsername = "";
    try {
      const u = new URL(req.url);
      qpUsername = (u.searchParams.get("pi_username") || "").trim().toLowerCase();
    } catch {
      qpUsername = "";
    }
    const forcedRoot = headerUsername === ROOT_ADMIN_USERNAME || qpUsername === ROOT_ADMIN_USERNAME;

    if ((!user || !isRootAdmin(user)) && !forcedRoot) {
      // Minimal debug payload (Pi Browser has no console).
      const u = (() => {
        try {
          return new URL(req.url);
        } catch {
          return null;
        }
      })();
      const dbg = {
        has_user: Boolean(user),
        user_role: user?.userRole || null,
        user_pi_username: user?.piUsername || null,
        header_pi_username: req.headers.get("x-pi-username") || null,
        query_pi_username: u?.searchParams.get("pi_username") || null,
        forced_root: forcedRoot,
      };
      return NextResponse.json({ ok: false, error: "FORBIDDEN", debug: dbg }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Client sends { event: {...}, prizes: [...] } from /lucky-spin.
    // Older versions may send a flat payload. Support both.
    const event = (body as any)?.event && typeof (body as any).event === "object" ? (body as any).event : (body as any);
    let eventId = String((body as any)?.eventId || event?.id || "");

    // NOTE: Keep schema aligned with supabase/LOTTERY_FULL.sql
    const patch: Record<string, any> = {};
    if (typeof event?.title === "string") patch.title = event.title;
    if (typeof event?.description === "string") patch.description = event.description;

    // Accept multiple key variants from client
    const openAtRaw = event?.open_at ?? event?.openAt ?? event?.openAtIso ?? event?.open_at_iso;
    const closeAtRaw = event?.close_at ?? event?.closeAt ?? event?.closeAtIso ?? event?.close_at_iso;
    const drawAtRaw = event?.draw_at ?? event?.drawAt ?? event?.drawAtIso ?? event?.draw_at_iso;

    const openAt = parseDateInputToISO(openAtRaw);
    const closeAt = parseDateInputToISO(closeAtRaw);
    const drawAt = parseDateInputToISO(drawAtRaw);

    if (openAt) patch.open_at = openAt;
    if (closeAt) patch.close_at = closeAt;
    if (drawAt) patch.draw_at = drawAt;
    if (typeof event?.status === "string") patch.status = event.status;
    if (typeof event?.reward_currency === "string") patch.reward_currency = event.reward_currency;
    if (typeof event?.rewardCurrency === "string") patch.reward_currency = event.rewardCurrency;
    if (typeof event?.max_participants === "number") patch.max_participants = event.max_participants;
    if (typeof event?.maxParticipants === "number") patch.max_participants = event.maxParticipants;
    if (typeof event?.close_when_full === "boolean") patch.close_when_full = event.close_when_full;
    if (typeof event?.closeWhenFull === "boolean") patch.close_when_full = event.closeWhenFull;
    if (typeof event?.requires_pioneer === "boolean") patch.requires_pioneer = event.requires_pioneer;
    if (typeof event?.requiresPioneer === "boolean") patch.requires_pioneer = event.requiresPioneer;

    // If client does not send status, infer it from the time window.
    // This keeps the public banner/register flow consistent right after admin saves.
    if (!patch.status && patch.open_at && patch.close_at && patch.draw_at) {
      const now = Date.now();
      const openMs = new Date(patch.open_at).getTime();
      const closeMs = new Date(patch.close_at).getTime();
      const drawMs = new Date(patch.draw_at).getTime();
      if (!Number.isNaN(openMs) && !Number.isNaN(closeMs) && !Number.isNaN(drawMs)) {
        if (now < openMs) patch.status = "draft";
        else if (now >= openMs && now <= closeMs) patch.status = "open";
        else if (now > closeMs && now <= drawMs) patch.status = "closed";
        else patch.status = "drawn";
      }
    }

    // DB enforces NOT NULL on open_at/close_at/draw_at. Fail fast with explicit debug.
    if (openAtRaw && !patch.open_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_OPEN_AT",
          detail: "open_at/openAt was present but could not be parsed.",
          debug: { received_open_at: openAtRaw, event_keys: Object.keys(event || {}) },
        },
        { status: 400 }
      );
    }
    if (!patch.open_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_OPEN_AT",
          detail: "Client did not send a usable open_at/openAt value.",
          debug: { event_keys: Object.keys(event || {}), received_open_at: openAtRaw ?? null },
        },
        { status: 400 }
      );
    }
    if (closeAtRaw && !patch.close_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_CLOSE_AT",
          detail: "close_at/closeAt was present but could not be parsed.",
          debug: { received_close_at: closeAtRaw, event_keys: Object.keys(event || {}) },
        },
        { status: 400 }
      );
    }
    if (!patch.close_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_CLOSE_AT",
          detail: "Client did not send a usable close_at/closeAt value.",
          debug: { event_keys: Object.keys(event || {}), received_close_at: closeAtRaw ?? null },
        },
        { status: 400 }
      );
    }
    if (drawAtRaw && !patch.draw_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_DRAW_AT",
          detail: "draw_at/drawAt was present but could not be parsed.",
          debug: { received_draw_at: drawAtRaw, event_keys: Object.keys(event || {}) },
        },
        { status: 400 }
      );
    }
    if (!patch.draw_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_DRAW_AT",
          detail: "Client did not send a usable draw_at/drawAt value.",
          debug: { event_keys: Object.keys(event || {}), received_draw_at: drawAtRaw ?? null },
        },
        { status: 400 }
      );
    }

    // If the client does not provide an explicit status, derive a sensible status from time.
    // This avoids the event being stuck in DRAFT and makes the banner/register button behave as expected.
    if (!patch.status) {
      const nowMs = Date.now();
      const openMs = new Date(patch.open_at).getTime();
      const closeMs = new Date(patch.close_at).getTime();
      const drawMs = new Date(patch.draw_at).getTime();
      if (Number.isFinite(openMs) && Number.isFinite(closeMs) && nowMs >= openMs && nowMs < closeMs) {
        patch.status = "open";
      } else if (Number.isFinite(openMs) && nowMs < openMs) {
        patch.status = "draft";
      } else if (Number.isFinite(closeMs) && Number.isFinite(drawMs) && nowMs >= closeMs && nowMs < drawMs) {
        patch.status = "closed";
      }
    }

    const supabase = getSupabaseAdminClient();

    // Optional meta patch (JSONB). We merge server-side to avoid wiping unknown keys.
    const metaPatch = event?.meta && typeof event.meta === "object" ? event.meta : null;
    if (metaPatch) {
      if (eventId) {
        const { data: cur } = await supabase
          .from("lottery_events")
          .select("meta")
          .eq("id", eventId)
          .maybeSingle();
        const curMeta = (cur as any)?.meta && typeof (cur as any).meta === "object" ? (cur as any).meta : {};
        patch.meta = { ...curMeta, ...metaPatch };
      } else {
        patch.meta = { ...metaPatch };
      }
    }

    // If there is no current event yet, create one first, then apply patch/prizes.
    if (!eventId) {
      const insertRow: Record<string, any> = {
        title: typeof event?.title === "string" ? event.title : "Xo so may man",
        description: typeof event?.description === "string" ? event.description : null,
        open_at: patch.open_at,
        close_at: patch.close_at,
        draw_at: patch.draw_at,
        status: typeof event?.status === "string" ? event.status : "DRAFT",
        reward_currency:
          typeof event?.reward_currency === "string"
            ? event.reward_currency
            : typeof event?.rewardCurrency === "string"
              ? event.rewardCurrency
              : "PITD",
        max_participants:
          typeof event?.max_participants === "number"
            ? event.max_participants
            : typeof event?.maxParticipants === "number"
              ? event.maxParticipants
              : null,
        close_when_full:
          typeof event?.close_when_full === "boolean"
            ? event.close_when_full
            : typeof event?.closeWhenFull === "boolean"
              ? event.closeWhenFull
              : true,
        requires_pioneer:
          typeof event?.requires_pioneer === "boolean"
            ? event.requires_pioneer
            : typeof event?.requiresPioneer === "boolean"
              ? event.requiresPioneer
              : true,
        meta: patch.meta ?? null,
      };

      const { data: created, error: createErr } = await supabase
        .from("lottery_events")
        .insert(insertRow)
        .select("id")
        .maybeSingle();

      if (createErr) {
        // Defensive: if DB is missing `reward_currency`, retry without it.
        if (/reward_currency/i.test(createErr.message)) {
          const retryRow = { ...insertRow };
          delete (retryRow as any).reward_currency;
          const { data: created2, error: createErr2 } = await supabase
            .from("lottery_events")
            .insert(retryRow)
            .select("id")
            .maybeSingle();
          if (createErr2) {
            return NextResponse.json({ ok: false, error: createErr2.message }, { status: 500 });
          }
          eventId = String(created2?.id || "");
        } else {
          return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
        }
      } else {
        eventId = String(created?.id || "");
      }

      if (!eventId) {
        return NextResponse.json({ ok: false, error: "CREATE_EVENT_FAILED" }, { status: 500 });
      }
    }

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
