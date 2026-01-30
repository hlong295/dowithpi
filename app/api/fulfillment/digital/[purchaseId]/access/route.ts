export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * P2.2 Digital goods access.
 * - Buyer-only (prevents leaking secret link).
 * - Returns deliverable_url from metadata if present.
 */
export async function GET(req: Request, ctx: { params: { purchaseId: string } }) {
  try {
    const purchaseId = String(ctx?.params?.purchaseId || "").trim();
    if (!purchaseId) return json({ message: "NO_PURCHASE_ID" }, 400);

    const requester = await getAuthenticatedUserId(req);
    if (!requester) return json({ message: "UNAUTHENTICATED" }, 401);

    const supabaseAdmin = getSupabaseAdminClient();
    const master = await resolveMasterUserId(supabaseAdmin, requester);
    const requesterId = master.userId;

    // Load purchase owner
    const { data: purchase, error: purErr } = await supabaseAdmin
      .from("user_purchases")
      .select("id, user_id, product_id, status")
      .eq("id", purchaseId)
      .maybeSingle();
    if (purErr) return json({ message: purErr.message }, 500);
    if (!purchase) return json({ message: "PURCHASE_NOT_FOUND" }, 404);

    const ownerId = String((purchase as any).user_id || "");
    if (!ownerId || ownerId !== requesterId) {
      return json({ message: "FORBIDDEN" }, 403);
    }

    const { data: df, error: dfErr } = await supabaseAdmin
      .from("digital_fulfillments")
      .select("id, purchase_id, status, metadata, created_at")
      .eq("purchase_id", purchaseId)
      .maybeSingle();
    if (dfErr) return json({ message: dfErr.message }, 500);
    if (!df) return json({ message: "DIGITAL_FULFILLMENT_NOT_FOUND" }, 404);

    const deliverableUrl = (df as any)?.metadata?.deliverable_url || null;
    if (!deliverableUrl) return json({ ok: true, status: (df as any).status, url: null }, 200);

    return json({ ok: true, status: (df as any).status, url: deliverableUrl }, 200);
  } catch (e: any) {
    return json({ message: e?.message || "Unknown error" }, 500);
  }
}
