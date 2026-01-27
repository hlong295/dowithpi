import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

// Ensure server-side secrets are available consistently (avoid edge runtime surprises)
export const runtime = "nodejs";

// Never allow caching for settings reads (Pi Browser can cache aggressively).
const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// NOTE: `public.app_settings` may contain multiple rows (historical snapshots).
// PITD Rules are stored/retrieved from a single well-known row to avoid
// accidentally reading an older/empty row.
const APP_SETTINGS_SINGLETON_ID = "11111111-1111-1111-1111-111111111111";

function isRootAdmin(piUsername?: string | null) {
  return (piUsername || "").toLowerCase() === "hlong295";
}

function isAdminRole(userRole?: string | null) {
  const r = (userRole || "").toLowerCase();
  return r === "admin" || r === "root_admin";
}

function safeJsonParse<T = any>(v: string | null): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const raw = rest.join("=");
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

async function fallbackResolvePiUser(
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>,
  req: Request
) {
  // If our standard auth resolver fails (returns null), fall back to looking up pi_users
  // by either id (uuid) or pi_username from headers/cookies.
  const cookieHeader = req.headers.get("cookie");
  const cookieJson =
    parseCookieValue(cookieHeader, "pitodo_pi_user") ||
    parseCookieValue(cookieHeader, "pi_user") ||
    parseCookieValue(cookieHeader, "piUser") ||
    parseCookieValue(cookieHeader, "pi_user_session") ||
    parseCookieValue(cookieHeader, "pitodo_user") ||
    parseCookieValue(cookieHeader, "dwp_user") ||
    null;

  const cookieObj = safeJsonParse<any>(cookieJson);

  const headerUserId = req.headers.get("x-user-id") || req.headers.get("x-userid") || "";
  const headerUsername = req.headers.get("x-pi-username") || "";

  const candidateId =
    (typeof cookieObj?.piUserId === "string" && cookieObj.piUserId) ||
    (typeof cookieObj?.id === "string" && cookieObj.id) ||
    (typeof cookieObj?.uid === "string" && cookieObj.uid) ||
    (typeof cookieObj?.userId === "string" && cookieObj.userId) ||
    (typeof cookieObj?.pi_user_id === "string" && cookieObj.pi_user_id) ||
    headerUserId;

  const candidateUsername =
    (typeof cookieObj?.pi_username === "string" && cookieObj.pi_username) ||
    (typeof cookieObj?.username === "string" && cookieObj.username) ||
    headerUsername;

  // Try lookup by id first if it looks like uuid
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    candidateId || ""
  );
  if (looksUuid && candidateId) {
    const { data: piRow } = await supabaseAdmin
      .from("pi_users")
      .select("id, pi_username, user_role")
      .eq("id", candidateId)
      .maybeSingle();
    if (piRow) return piRow;
  }

  if (candidateUsername) {
    const { data: piRow } = await supabaseAdmin
      .from("pi_users")
      .select("id, pi_username, user_role")
      .ilike("pi_username", candidateUsername)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (piRow) return piRow;
  }

  return null;
}

/**
 * Best-effort resolver for the requester Pi user row.
 *
 * We primarily authorize by `user_role` and/or root `pi_username`.
 * In some environments (Pi Browser / pinet), the auth identifier can be the
 * master `public.users.id` or the `pi_users.id`. This function tries both.
 */
async function getFallbackRequesterPiUser(
  req: Request,
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>
) {
  // 1) Prefer the authenticated userId (master user id)
  const userId = await getAuthenticatedUserId(req);
  if (userId) {
    const { data } = await supabaseAdmin
      .from("pi_users")
      .select("id, pi_username, user_role")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data as { id: string; pi_username: string | null; user_role: string | null };
  }

  // 2) Fallback to cookie/header parsing (pi_username)
  return await fallbackResolvePiUser(supabaseAdmin, req);
}

// IMPORTANT: This list MUST match the real columns that exist in public.app_settings.
// If a non-existent column is included here, PostgREST will return 400 and the whole
// PITD rules page/save will fail.
// Keep this aligned with the fields rendered in /app/admin/pitd-management/page.tsx
// and the SQL migration SQL_P4P1_ADD_PITD_RULES_TO_APP_SETTINGS.sql.
const RULE_COLUMNS = [
  "id",
  // Sink costs
  "cost_post_product",
  "cost_comment",
  "cost_review",
  "cost_boost",

  // Pi → PITD topup
  "pi_to_pitd_rate",
  "topup_min_pi",
  "topup_max_pi",

  // Transfer policy (the UI uses these names)
  "transfer_policy_enabled",
  "transfer_eligibility",
  "transfer_limit_per_day",
  "transfer_limit_per_week",
  "transfer_max_per_tx",
  "transfer_tx_per_day",
  "transfer_fee_pitd",
  "transfer_cooldown_hours",
].join(",");

function parseNumericOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n)) {
      // Let the API return a useful error instead of a silent 500.
      throw new Error(`INVALID_NUMBER:${field}`);
    }
    return n;
  }
  // Unsupported types -> treat as null.
  return null;
}

function serializeError(err: unknown) {
  try {
    if (err && typeof err === "object") {
      // Supabase errors often have these fields
      const anyErr: any = err as any;
      return {
        message: anyErr.message ?? String(err),
        details: anyErr.details,
        hint: anyErr.hint,
        code: anyErr.code,
        // Best-effort full dump for Pi Browser screenshots (no console)
        raw: JSON.stringify(err, Object.getOwnPropertyNames(anyErr)),
      };
    }
    return { message: String(err) };
  } catch {
    return { message: "(unable to serialize error)" };
  }
}

async function readSingleAppSettingsRow(supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>) {
  // Always read the singleton row. The table may contain older/historical rows.
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select(RULE_COLUMNS)
    .eq("id", APP_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    // Create the singleton row if missing (idempotent).
    const { data: created, error: createErr } = await supabaseAdmin
      .from("app_settings")
      .insert({ id: APP_SETTINGS_SINGLETON_ID })
      .select(RULE_COLUMNS)
      .single();

    if (createErr) throw createErr;
    return created;
  }
  return data;
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const auth = await getAuthenticatedUserId(req);
    let userId = auth.userId;

    // If the strict auth resolver fails (common on Pi Browser where identity is stored
    // in app-specific cookies/localStorage), fall back to resolving the caller from
    // headers/cookies into pi_users, then allow only root/admin.
    let caller = null as { pi_username?: string | null; user_role?: string | null } | null;
    if (!userId) {
      const fb = await getFallbackRequesterPiUser(req, supabaseAdmin);
      if (!fb) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      caller = fb;
      userId = fb.id;
    } else {
      const { data, error } = await supabaseAdmin
        .from("pi_users")
        .select("pi_username, user_role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      caller = data as any;
    }

    const allowed = isRootAdmin(caller?.pi_username) || isAdminRole(caller?.user_role);
    if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    // Ensure master users row exists (best-effort)
    try {
      await supabaseAdmin.from("users").select("id").eq("id", userId).maybeSingle();
    } catch {
      // ignore
    }

    const row = await readSingleAppSettingsRow(supabaseAdmin);
    return NextResponse.json(row, {
      headers: {
        // Prevent caching so the admin page always rehydrates with the latest saved values.
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "PITD_RULES_GET_FAILED", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const auth = await getAuthenticatedUserId(req);
    let userId = auth.userId;
    let requesterPi = null as { id: string; pi_username?: string | null; user_role?: string | null } | null;

    if (!userId) {
      const fb = await getFallbackRequesterPiUser(req, supabaseAdmin);
      if (!fb) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      requesterPi = fb;
      userId = fb.id;
    } else {
      const { data, error } = await supabaseAdmin
        .from("pi_users")
        .select("id, pi_username, user_role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      requesterPi = data as any;
    }

    const allowed = isRootAdmin(requesterPi?.pi_username) || isAdminRole(requesterPi?.user_role);
    if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();

    const current = await readSingleAppSettingsRow(supabaseAdmin);

    const updates: Record<string, any> = {};

    // Numbers (decimal/numeric in DB): accept empty => null
    const numFields = [
      "cost_post_product",
      "cost_comment",
      "cost_review",
      "cost_boost",
      "pi_to_pitd_rate",
      "topup_min_pi",
      "topup_max_pi",
      "transfer_fee_pitd",
      "transfer_limit_per_day",
      "transfer_limit_per_week",
      "transfer_max_per_tx",
      "transfer_tx_per_day",
      "transfer_cooldown_hours",
    ];
    for (const k of numFields) {
      if (k in body) {
        const v = body[k];
        if (v === "" || v === null || typeof v === "undefined") {
          updates[k] = null;
        } else {
          const n = Number(v);
          if (Number.isNaN(n)) {
            return NextResponse.json({ error: "INVALID_NUMBER", field: k }, { status: 400 });
          }
          updates[k] = n;
        }
      }
    }

    // Booleans
    const boolFields = ["transfer_policy_enabled"];
    for (const k of boolFields) {
      if (k in body) updates[k] = Boolean(body[k]);
    }

    // Strings (nullable)
    const strFields = ["transfer_eligibility"];
    for (const k of strFields) {
      if (k in body) {
        const v = body[k];
        updates[k] = v === "" || v === null || typeof v === "undefined" ? null : String(v);
      }
    }

	    if (Object.keys(updates).length === 0) {
	      return NextResponse.json(
	        {
	          error: "PITD_RULES_NO_FIELDS",
	          message: "No fields to update",
	        },
	        { status: 400 }
	      );
	    }

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .update(updates)
      .eq("id", current.id)
      .select(RULE_COLUMNS)
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
	  } catch (e: any) {
	    const info = serializeError(e);
	    const msg = String(info?.message || "");
	    const isPerm = msg.toLowerCase().includes("permission denied") || String(info?.code) === "42501";

	    return NextResponse.json(
	      {
	        error: isPerm ? "PITD_DB_PERMISSION_DENIED" : "PITD_RULES_SAVE_FAILED",
	        message: info?.message,
	        code: info?.code,
	        details: info?.details,
	        hint:
	          isPerm
	            ? "Run SQL GRANT for service_role on public.app_settings, then retry."
	            : info?.hint,
	        debug: isPerm
	          ? {
	              sql_grant: [
	                "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_settings TO service_role;",
	                "GRANT USAGE ON SCHEMA public TO service_role;",
	              ].join("\n"),
	            }
	          : undefined,
	      },
	      { status: 500 }
	    );
	  }
}
