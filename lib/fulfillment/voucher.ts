import crypto from "crypto";

// Voucher fulfillment is server-only. Do NOT import this file into client components.

export type VoucherStatus = "ACTIVE" | "USED" | "CANCELLED";

export function generateRedeemCode(len = 12): string {
  // Human-friendly: uppercase letters + digits (avoid 0/O, 1/I ambiguity)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function createVoucherFulfillment(args: {
  supabaseAdmin: any;
  purchaseId: string;
  userId: string;
  productId: string;
  debugTag?: string;
}) {
  const { supabaseAdmin, purchaseId, userId, productId, debugTag } = args;

  // Insert with a few retries in case redeem_code conflicts (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    const redeemCode = generateRedeemCode(12);
    const payload: any = {
      purchase_id: purchaseId,
      user_id: userId,
      product_id: productId,
      redeem_code: redeemCode,
      status: "ACTIVE",
      metadata: debugTag ? { debugTag } : null,
    };

    const { data, error } = await supabaseAdmin
      .from("voucher_fulfillments")
      .insert(payload)
      .select("id, redeem_code, status, created_at")
      .maybeSingle();

    if (!error && data) {
      return { ok: true, fulfillment: data };
    }

    // If purchase already has a fulfillment, return it (idempotent).
    const msg = (error as any)?.message || "";
    const isPurchaseUnique = /voucher_fulfillments_purchase_id_key/i.test(msg) || /duplicate key value/i.test(msg);
    if (isPurchaseUnique) {
      const { data: existing } = await supabaseAdmin
        .from("voucher_fulfillments")
        .select("id, redeem_code, status, created_at")
        .eq("purchase_id", purchaseId)
        .maybeSingle();
      if (existing) return { ok: true, fulfillment: existing, alreadyExisted: true };
    }
  }

  return { ok: false, error: "VOUCHER_FULFILLMENT_CREATE_FAILED" };
}
