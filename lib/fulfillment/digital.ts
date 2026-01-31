import crypto from "crypto";

type CreateDigitalFulfillmentArgs = {
  supabaseAdmin: any;
  purchaseId: string;
  userId: string;
  productId: string;
  /** Optional product object (from products select). Used to extract deliverable if present. */
  product?: any;
  debugTag?: string;
};

function randomCode(len = 12) {
  // Uppercase alnum (avoid confusing chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function extractDigitalDeliverableUrl(product: any): string | null {
  // Best-effort: look for a media entry that looks like a downloadable link
  // while keeping backward compatibility (no DB migration).
  const media = product?.media;
  if (Array.isArray(media)) {
    for (const m of media) {
      const type = String(m?.type || "").toLowerCase();
      const url = String(m?.url || "").trim();
      if (!url) continue;
      if (["digital", "download", "file", "digital_download", "digital_good"].includes(type)) return url;
      const u = url.toLowerCase();
      if (
        u.includes("download") ||
        u.endsWith(".pdf") ||
        u.endsWith(".zip") ||
        u.endsWith(".rar") ||
        u.endsWith(".epub") ||
        u.endsWith(".mobi") ||
        u.endsWith(".doc") ||
        u.endsWith(".docx") ||
        u.endsWith(".xls") ||
        u.endsWith(".xlsx") ||
        u.endsWith(".ppt") ||
        u.endsWith(".pptx")
      ) {
        return url;
      }
    }
  }
  return null;
}

/**
 * P2.2 Digital goods fulfillment.
 * - Always server-side.
 * - Idempotent by purchase_id unique constraint.
 * - Does NOT expose secret link via client-side reads; the access API controls visibility.
 */
export async function createDigitalFulfillment(args: CreateDigitalFulfillmentArgs): Promise<
  | { ok: true; fulfillment: any }
  | { ok: false; error: string }
> {
  const { supabaseAdmin, purchaseId, userId, productId, product, debugTag } = args;
  try {
    const accessCode = randomCode(16);
    const deliverableUrl = extractDigitalDeliverableUrl(product);

    const payload: any = {
      purchase_id: purchaseId,
      user_id: userId,
      product_id: productId,
      access_code: accessCode,
      status: deliverableUrl ? "READY" : "PENDING",
      metadata: {
        deliverable_url: deliverableUrl,
        created_by: debugTag || "server",
      },
    };

    const { data, error } = await supabaseAdmin
      .from("digital_fulfillments")
      .insert(payload)
      .select("id, purchase_id, user_id, product_id, access_code, status, created_at")
      .maybeSingle();

    if (!error && data) return { ok: true, fulfillment: data };

    const msg = error?.message || "DIGITAL_FULFILLMENT_INSERT_FAILED";
    const isUnique = /digital_fulfillments_purchase_id_key/i.test(msg) || /duplicate key value/i.test(msg);
    if (isUnique) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("digital_fulfillments")
        .select("id, purchase_id, user_id, product_id, access_code, status, created_at")
        .eq("purchase_id", purchaseId)
        .maybeSingle();
      if (!exErr && existing) return { ok: true, fulfillment: existing };
      return { ok: false, error: exErr?.message || msg };
    }

    return { ok: false, error: msg };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
