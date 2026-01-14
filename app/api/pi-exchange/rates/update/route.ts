import { NextResponse } from "next/server";

import { requireUser } from "@/lib/pitd/require-user";
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

async function canEditPrices(supabaseAdmin: any, user: any): Promise<boolean> {
  const role = String(user?.user_role || "");
  if (role === "root_admin" || role === "admin") return true;

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("pi_exchange_editor_ids")
    .eq("id", 1)
    .maybeSingle();

  const ids: string[] = Array.isArray(settings?.pi_exchange_editor_ids)
    ? settings.pi_exchange_editor_ids
    : [];

  return ids.includes(String(user?.id));
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const supabaseAdmin = getSupabaseAdminClient();

    const allowed = await canEditPrices(supabaseAdmin, user);
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

    const updaterLabel = await getUpdaterLabel(supabaseAdmin, user.id);

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
