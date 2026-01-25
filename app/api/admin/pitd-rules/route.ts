import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

function isRootAdmin(piUsername?: string | null) {
  return (piUsername || "").toLowerCase() === "hlong295";
}

function isAdminRole(userRole?: string | null) {
  const r = (userRole || "").toLowerCase();
  return r === "admin" || r === "root_admin";
}

const RULE_COLUMNS = [
  "id",
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
  "transfer_max_txs_per_day",
  "transfer_cooldown_hours",
  "transfer_requires_verified",
  "transfer_requires_2fa",
  "transfer_requires_provider",
  "transfer_requires_trust_level",
].join(",");

async function readSingleAppSettingsRow(supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select(RULE_COLUMNS)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    // Create a row if missing
    const { data: created, error: createErr } = await supabaseAdmin
      .from("app_settings")
      .insert({})
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

    const { userId } = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Authorize by user_id (more robust than relying on x-pi-username header)
    const { data: caller, error: callerErr } = await supabaseAdmin
      .from("pi_users")
      .select("pi_username, user_role")
      .eq("id", userId)
      .maybeSingle();
    if (callerErr) throw callerErr;
    const allowed = isRootAdmin(caller?.pi_username) || isAdminRole(caller?.user_role);
    if (!allowed) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Ensure the caller is a real user in DB (master user mechanism)
    await supabaseAdmin.from("users").select("id").eq("id", userId).maybeSingle();

    const row = await readSingleAppSettingsRow(supabaseAdmin);
    return NextResponse.json(row);
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

    const { userId } = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: requesterPi, error: requesterPiErr } = await supabaseAdmin
      .from("pi_users")
      .select("pi_username, user_role")
      .eq("id", userId)
      .maybeSingle();

    if (requesterPiErr) throw requesterPiErr;
    const allowed = isRootAdmin(requesterPi?.pi_username) || isAdminRole(requesterPi?.user_role);
    if (!allowed) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

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
      "transfer_max_txs_per_day",
      "transfer_cooldown_hours",
      "transfer_requires_trust_level",
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
    const boolFields = [
      "transfer_requires_verified",
      "transfer_requires_2fa",
      "transfer_requires_provider",
    ];
    for (const k of boolFields) {
      if (k in body) updates[k] = Boolean(body[k]);
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
    return NextResponse.json(
      { error: "PITD_RULES_SAVE_FAILED", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
