import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

function normCode(code: string): string {
  return String(code || "").trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { user, error: userError } = await getCurrentUser(req);
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const redeem_code = normCode(body?.redeem_code);
    if (!redeem_code) {
      return NextResponse.json({ ok: false, error: "MISSING_REDEEM_CODE" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Fetch purchase by metadata.fulfillment.redeem_code
    const { data: purchase, error: purchaseErr } = await supabaseAdmin
      .from("user_purchases")
      .select("id,user_id,product_id,status,metadata")
      .contains("metadata", { fulfillment: { redeem_code } })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (purchaseErr) {
      return NextResponse.json({ ok: false, error: "PURCHASE_LOOKUP_FAILED", detail: purchaseErr.message }, { status: 500 });
    }
    if (!purchase) {
      return NextResponse.json({ ok: false, error: "REDEEM_CODE_NOT_FOUND" }, { status: 404 });
    }

    // Already used?
    const existing = (purchase.metadata || {}) as any;
    const fulfillment = existing?.fulfillment;
    if (fulfillment?.used_at) {
      return NextResponse.json({ ok: true, status: "ALREADY_USED", used_at: fulfillment.used_at, used_by: fulfillment.used_by });
    }

    // Role check: allow root admin; otherwise provider must own product
    const role = (user as any).role || (user as any).user_role || null;
    const isAdmin = role === "admin" || role === "root_admin";

    if (!isAdmin) {
      const { data: prod, error: prodErr } = await supabaseAdmin
        .from("products")
        .select("id,provider_id")
        .eq("id", purchase.product_id)
        .maybeSingle();
      if (prodErr) {
        return NextResponse.json({ ok: false, error: "PRODUCT_LOOKUP_FAILED", detail: prodErr.message }, { status: 500 });
      }
      if (!prod || !prod.provider_id) {
        return NextResponse.json({ ok: false, error: "PRODUCT_PROVIDER_NOT_FOUND" }, { status: 400 });
      }
      if (prod.provider_id !== user.id) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN_NOT_OWNER" }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const nextMetadata = {
      ...existing,
      fulfillment: {
        ...(fulfillment || {}),
        used_at: now,
        used_by: user.id,
      },
    };

    const { error: updErr } = await supabaseAdmin
      .from("user_purchases")
      .update({
        status: "used",
        metadata: nextMetadata,
      })
      .eq("id", purchase.id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: "REDEEM_UPDATE_FAILED", detail: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "USED", purchase_id: purchase.id, used_at: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "UNEXPECTED", detail: e?.message || String(e) }, { status: 500 });
  }
}
