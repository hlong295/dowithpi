export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request, ctx: { params: { purchaseId: string } }) {
  try {
    const purchaseId = String(ctx?.params?.purchaseId || "").trim();
    if (!purchaseId) return json({ message: "NO_PURCHASE_ID" }, 400);

    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const note = String(body?.note || "").trim();

    const requester = await getAuthenticatedUserId(req);
    if (!requester) return json({ message: "UNAUTHENTICATED" }, 401);

    const supabaseAdmin = getSupabaseAdminClient();
    const master = await resolveMasterUserId(supabaseAdmin, requester);
    const requesterId = master.userId;

    // Load purchase + product.provider_id for permission
    const { data: purchase, error: purErr } = await supabaseAdmin
      .from("user_purchases")
      .select("id, user_id, status, product:products(id, provider_id)")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purErr) return json({ message: purErr.message }, 500);
    if (!purchase) return json({ message: "PURCHASE_NOT_FOUND" }, 404);

    const providerId = String((purchase as any)?.product?.provider_id || "");

    let allowed = false;
    // Root admin allowed
    try {
      await requireAdmin(requesterId);
      allowed = true;
    } catch {
      // not admin
    }
    // Provider owner allowed
    if (!allowed && providerId && providerId === requesterId) {
      allowed = true;
    }
    if (!allowed) return json({ message: "FORBIDDEN" }, 403);

    const nowIso = new Date().toISOString();

    // Mark voucher fulfillment USED (idempotent)
    const { data: updatedVf, error: vfErr } = await supabaseAdmin
      .from("voucher_fulfillments")
      .update({ status: "USED", used_at: nowIso, used_by: requesterId, used_note: note || null })
      .eq("purchase_id", purchaseId)
      .select("id, redeem_code, status, used_at, used_by, used_note")
      .maybeSingle();

    if (vfErr) return json({ message: vfErr.message, code: "VOUCHER_USE_FAILED" }, 500);
    if (!updatedVf) return json({ message: "VOUCHER_NOT_FOUND" }, 404);

    // Update purchase status to USED (best-effort)
    await supabaseAdmin.from("user_purchases").update({ status: "used" }).eq("id", purchaseId);

    return json({ ok: true, voucher: updatedVf });
  } catch (e: any) {
    return json({ message: e?.message || "Unknown error" }, 500);
  }
}
