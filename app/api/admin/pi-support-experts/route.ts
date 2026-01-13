export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

function normalizeId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const c = (v as any)?.id ?? (v as any)?.userId ?? (v as any)?.value;
    return typeof c === "string" ? c.trim() : c ? String(c).trim() : "";
  }
  return String(v).trim();
}

function toChargeMode(v: any): "FREE" | "PI" | "PITD" | "BOTH" {
  const s = String(v || "FREE").toUpperCase();
  if (s === "PI" || s === "PITD" || s === "BOTH") return s;
  return "FREE";
}

function toAreas(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  const s = String(v || "").trim();
  if (!s) return [];
  // Accept comma/newline separated text
  return s
    .split(/[,\n]/g)
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
    if (!supabaseAdmin) {
      return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("pi_support_experts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ ok: false, error: "query_failed", detail: error.message }, { status: 500 });
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
    if (!supabaseAdmin) {
      return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const expert = (body?.expert && typeof body.expert === "object") ? body.expert : body;

    const id = normalizeId(expert?.id);

    // UI sends `username` (pi_username) instead of `user_id`.
    // Resolve to `public.users.id` (master) so we can satisfy FK pi_support_experts.user_id -> users.id.
    let user_id = normalizeId(expert?.user_id ?? expert?.userId);
    if (!user_id) {
      const piUsername = String(expert?.username ?? expert?.pi_username ?? expert?.piUsername ?? "").trim();
      if (piUsername) {
        const resolved = await resolveMasterUserId(supabaseAdmin, null, null, piUsername);
        user_id = normalizeId(resolved?.userId);
      }
    }
    if (!user_id) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
    }

    const payload: any = {
      user_id,
      display_name: (expert?.display_name ?? expert?.displayName ?? null) ? String(expert?.display_name ?? expert?.displayName).trim() : null,
      areas: toAreas(expert?.areas),
      charge_mode: toChargeMode(expert?.charge_mode ?? expert?.chargeMode),
      price_pi: expert?.price_pi ?? expert?.pricePi ?? null,
      price_pitd: expert?.price_pitd ?? expert?.pricePitd ?? null,
      note: (expert?.note ?? null) ? String(expert?.note).trim() : null,
      is_active: expert?.is_active === false ? false : true,
      updated_by: requesterId,
    };

    if (id) payload.id = id;
    else payload.created_by = requesterId;

    const { data, error } = await supabaseAdmin
      .from("pi_support_experts")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: "upsert_failed", detail: error.message }, { status: 500 });
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
    if (!supabaseAdmin) {
      return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
    }

    const url = new URL(req.url);
    const id = normalizeId(url.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("pi_support_experts").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: "delete_failed", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
