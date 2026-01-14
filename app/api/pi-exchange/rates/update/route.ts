import { NextResponse } from "next/server";

import { requireUser, requireUserExists } from "@/lib/pitd/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type Body = {
  buy_price_vnd?: number | string;
  sell_price_vnd?: number | string;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function getUpdaterLabel(supabaseAdmin: any, userId: string): Promise<string> {
  // Try pi_users first (Pi login), then users (email login).
  const { data: piRow } = await supabaseAdmin
    .from("pi_users")
    .select("pi_username,email,pi_uid,id")
    .eq("id", userId)
    .maybeSingle();

  const piUsername = piRow?.pi_username || "";
  if (piUsername) return String(piUsername);

  const piEmail = piRow?.email || "";
  if (piEmail && typeof piEmail === "string") return piEmail.split("@")[0];

  const { data: uRow } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const email = uRow?.email;
  if (email && typeof email === "string") return email.split("@")[0];

  return String(piRow?.pi_uid || userId);
}

async function ensureAppSettingsRow(sb: any) {
  const { data } = await sb.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (data) return data;

  // Deterministic singleton row.
  const { data: inserted, error } = await sb
    .from("app_settings")
    .upsert(
      {
        id: 1,
        service_fee_percentage: 2,
        tax_percentage: 8,
      },
      { onConflict: "id" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return inserted;
}

async function getEffectiveRole(sb: any, userId: string): Promise<string> {
  const { data: uRow } = await sb.from("users").select("user_role").eq("id", userId).maybeSingle();
  const role1 = String(uRow?.user_role || "").trim();
  if (role1) return role1;

  const { data: piRow } = await sb.from("pi_users").select("user_role").eq("id", userId).maybeSingle();
  return String(piRow?.user_role || "").trim();
}

async function canEditPrices(supabaseAdmin: any, userId: string): Promise<boolean> {
  const role = await getEffectiveRole(supabaseAdmin, userId);
  if (role === "root_admin" || role === "admin") return true;

  const settings = await ensureAppSettingsRow(supabaseAdmin);
  const ids: string[] = Array.isArray(settings?.pi_exchange_editor_ids)
    ? settings.pi_exchange_editor_ids
    : [];

  return ids.includes(String(userId));
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser(req);
    // Validate user exists (supports both email users and Pi users).
    await requireUserExists(userId);
    const supabaseAdmin = getSupabaseAdminClient();

    const allowed = await canEditPrices(supabaseAdmin, userId);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const buy = toNumber(body.buy_price_vnd);
    const sell = toNumber(body.sell_price_vnd);

    if (buy === null || sell === null) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    await ensureAppSettingsRow(supabaseAdmin);

    const updaterLabel = await getUpdaterLabel(supabaseAdmin, userId);

    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({
        pi_buy_price_vnd: buy,
        pi_sell_price_vnd: sell,
        pi_exchange_updated_at: new Date().toISOString(),
        pi_exchange_updated_by: updaterLabel,
      })
      .eq("id", 1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rates: {
        buy_price_vnd: buy,
        sell_price_vnd: sell,
        updated_at: new Date().toISOString(),
        updated_by: updaterLabel,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN" },
      { status: 500 }
    );
  }
}
