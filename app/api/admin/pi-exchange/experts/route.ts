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
      return NextResponse.json(
        { ok: false, error: "query_failed", detail: error.message },
        { status: 500 }
      );
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
      price_pi: expert?.price_pi ?? expert?.pricePi ?? null,
      price_pitd: expert?.price_pitd ?? expert?.pricePitd ?? null,
      note: normText(expert?.note) || null,
      is_active: expert?.is_active === false ? false : true,
      updated_by: requesterId,
    };

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
      return NextResponse.json(
        { ok: false, error: "upsert_failed", detail: error.message },
        { status: 500 }
      );
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
      return NextResponse.json(
        { ok: false, error: "delete_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
