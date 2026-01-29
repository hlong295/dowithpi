export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { inferItemType } from "@/lib/product-type";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const purchaseId = String(ctx?.params?.id || "").trim();
    if (!purchaseId) return json({ message: "NO_PURCHASE_ID" }, 400);

    const requester = await getAuthenticatedUserId(req);
    if (!requester) return json({ message: "UNAUTHENTICATED" }, 401);

    const supabaseAdmin = getSupabaseAdminClient();
    const master = await resolveMasterUserId(supabaseAdmin, requester);
    const requesterId = master.userId;

    // Load purchase + product
    const { data: purchase, error: purErr } = await supabaseAdmin
      .from("user_purchases")
      .select(
        `
        id, user_id, product_id, quantity, unit_price, total_price, payment_method, status, created_at,
        product:products(id, name, title, image_url, media, description, provider_id)
      `,
      )
      .eq("id", purchaseId)
      .maybeSingle();

    if (purErr) return json({ message: purErr.message }, 500);
    if (!purchase) return json({ message: "PURCHASE_NOT_FOUND" }, 404);

    const purchaseUserId = String((purchase as any).user_id || "");
    const product = (purchase as any).product || null;
    const providerId = String(product?.provider_id || "");

    // Permission:
    // - Owner can view
    // - Root admin can view
    // - Provider owner (product.provider_id) can view
    let canView = false;
    let canConfirmUsed = false;

    if (purchaseUserId && purchaseUserId === requesterId) {
      canView = true;
    } else {
      // Try admin first
      try {
        await requireAdmin(requesterId);
        canView = true;
        canConfirmUsed = true;
      } catch {
        // Not admin
      }
      // Provider owner
      if (!canView && providerId && providerId === requesterId) {
        canView = true;
        canConfirmUsed = true;
      }
    }

    if (!canView) return json({ message: "FORBIDDEN" }, 403);

    const itemType = inferItemType(product);

    // Voucher fulfillment (optional)
    let voucher: any = null;
    let digital: any = null;
    let canAccessDigital = false;
    if (itemType === "voucher") {
      const { data: vf } = await supabaseAdmin
        .from("voucher_fulfillments")
        .select("id, redeem_code, status, used_at, used_by, used_note, created_at")
        .eq("purchase_id", purchaseId)
        .maybeSingle();
      voucher = vf || null;
    }

    // Digital fulfillment (optional) - do NOT expose secret link here.
    if (itemType === "digital") {
      const { data: df } = await supabaseAdmin
        .from("digital_fulfillments")
        .select("id, status, access_code, created_at, metadata")
        .eq("purchase_id", purchaseId)
        .maybeSingle();
      if (df) {
        const hasUrl = Boolean((df as any)?.metadata?.deliverable_url);
        const code = String((df as any)?.access_code || "");
        digital = {
          id: (df as any).id,
          status: (df as any).status,
          has_url: hasUrl,
          // Show a safe hint only (not the full code)
          code_hint: code ? `${code.slice(0, 4)}…${code.slice(-4)}` : null,
          created_at: (df as any).created_at,
        };
      }
      // Only buyer can access the actual download link
      canAccessDigital = purchaseUserId === requesterId;
    }

    return json({ ok: true, purchase, itemType, voucher, digital, canAccessDigital, canConfirmUsed });
  } catch (e: any) {
    return json({ message: e?.message || "Unknown error" }, 500);
  }
}
