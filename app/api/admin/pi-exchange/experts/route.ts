export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

function normText(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toPricingType(v: any): "FREE" | "PI" | "PITD" | "BOTH" {
  const s = normText(v).toUpperCase();
  if (s === "PI" || s === "PITD" || s === "BOTH") return s;
  return "FREE";
}

function toCategory(v: any): "KYC_MAINNET" | "PI_NODE" | "PI_NETWORK" {
  const s = normText(v).toUpperCase();
  if (s === "PI_NODE") return "PI_NODE";
  if (s === "PI_NETWORK") return "PI_NETWORK";
  return "KYC_MAINNET";
}

function toChatApps(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => normText(x)).filter(Boolean);
  const s = normText(v);
  if (!s) return [];
  return s
    .split(/[\n,]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Postgres `numeric` columns cannot accept empty string ("").
// The admin form may send "" for fee inputs, so we normalize to number | null.
function toNumericOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = normText(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapDbError(error: any) {
  const msg = String(error?.message || error || "");
  const code = String((error as any)?.code || "");

  // 42P01 = undefined_table
  if (code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("undefined_table")) {
    return {
      error: "EXPERTS_TABLE_MISSING",
      detail: msg,
      hint: "Run SQL_pi_buy_sell_experts.sql to create pi_buy_sell_experts table (and grants).",
    };
  }

  // Permission errors even with service role (GRANT missing)
  if (msg.toLowerCase().includes("permission denied") || code === "42501") {
    return {
      error: "EXPERTS_DB_PERMISSION_DENIED",
      detail: msg,
      hint:
        "Run the GRANT statements in SQL_pi_buy_sell_experts.sql (grant select/insert/update/delete on pi_buy_sell_experts to service_role; grant select to anon/authenticated).",
    };
  }

  return { error: "DB_ERROR", detail: msg };
}

export async function GET(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    await requireAdmin(requesterId);

    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("pi_buy_sell_experts")
      .select(
        "id,category,username,full_name,phone,chat_apps,chat_handle,pricing_type,price_pi,price_pitd,note,is_active,updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      const mapped = mapDbError(error);
      return NextResponse.json({ ok: false, ...mapped }, { status: 500 });
    }

    return NextResponse.json({ ok: true, experts: data || [] });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    await requireAdmin(requesterId);

    const supabaseAdmin = getSupabaseAdminClient();

    const body = await req.json().catch(() => ({} as any));
    const expert = (body?.expert && typeof body.expert === "object") ? body.expert : body;

    const payload: any = {
      category: toCategory(expert?.category),
      username: normText(expert?.username),
      full_name: normText(expert?.full_name || expert?.fullName) || null,
      phone: normText(expert?.phone) || null,
      chat_apps: toChatApps(expert?.chat_apps || expert?.chatApps),
      chat_handle: normText(expert?.chat_handle || expert?.chatHandle) || null,
      pricing_type: toPricingType(expert?.pricing_type || expert?.pricingType),
      // Normalize numeric inputs: avoid sending empty string to Postgres numeric.
      // Also keep fee fields aligned with pricing_type.
      price_pi: null,
      price_pitd: null,
      note: normText(expert?.note) || null,
      is_active: expert?.is_active === false ? false : true,
      updated_by: requesterId,
    };

    const rawPi = expert?.price_pi ?? expert?.pricePi ?? null;
    const rawPitd = expert?.price_pitd ?? expert?.pricePitd ?? null;
    const nPi = toNumericOrNull(rawPi);
    const nPitd = toNumericOrNull(rawPitd);

    if (payload.pricing_type === "PI") {
      payload.price_pi = nPi;
    } else if (payload.pricing_type === "PITD") {
      payload.price_pitd = nPitd;
    } else if (payload.pricing_type === "BOTH") {
      payload.price_pi = nPi;
      payload.price_pitd = nPitd;
    } else {
      // FREE
      payload.price_pi = null;
      payload.price_pitd = null;
    }

    if (!payload.username) {
      return NextResponse.json({ ok: false, error: "MISSING_USERNAME" }, { status: 400 });
    }

    const id = normText(expert?.id);
    if (id) payload.id = id;
    else payload.created_by = requesterId;

    const { data, error } = await supabaseAdmin
      .from("pi_buy_sell_experts")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id,category,username,full_name,phone,chat_apps,chat_handle,pricing_type,price_pi,price_pitd,note,is_active,updated_at"
      )
      .maybeSingle();

    if (error) {
      const mapped = mapDbError(error);
      return NextResponse.json({ ok: false, ...mapped }, { status: 500 });
    }

    return NextResponse.json({ ok: true, expert: data });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}

export async function DELETE(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    await requireAdmin(requesterId);

    const supabaseAdmin = getSupabaseAdminClient();

    const url = new URL(req.url);
    const id = normText(url.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("pi_buy_sell_experts").delete().eq("id", id);
    if (error) {
      const mapped = mapDbError(error);
      return NextResponse.json({ ok: false, ...mapped }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
