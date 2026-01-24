export type ItemType = "physical" | "voucher" | "digital"

function normalizeType(v: any): ItemType | null {
  const s = String(v || "")
    .trim()
    .toLowerCase()
  if (s === "physical" || s === "ship" || s === "shipping") return "physical"
  if (s === "voucher" || s === "service" || s === "services" || s === "local_service") return "voucher"
  if (s === "digital" || s === "download" || s === "file" || s === "code") return "digital"
  return null
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase()
  return keywords.some((k) => t.includes(k))
}

function looksLikeDigitalUrl(url: string): boolean {
  const u = url.toLowerCase()
  return (
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
  )
}

/**
 * Infer the item type without requiring a DB migration.
 * Priority:
 *  1) explicit columns if present (item_type/product_type/type)
 *  2) jsonb metadata-like fields if present (metadata.item_type / metadata.type)
 *  3) heuristics from existing product fields (shipping, media, description)
 */
export function inferItemType(p: any): ItemType {
  // 1) Explicit fields (if a migration adds these later, this auto-picks it up)
  const explicit =
    normalizeType(p?.item_type) ||
    normalizeType(p?.product_type) ||
    normalizeType(p?.type) ||
    normalizeType(p?.itemType)
  if (explicit) return explicit

  // 2) metadata jsonb (if present)
  const meta = p?.metadata || p?.meta || null
  const metaType = meta ? normalizeType(meta?.item_type ?? meta?.type ?? meta?.itemType) : null
  if (metaType) return metaType

  // 3) Heuristics
  const shippingEnabled = Boolean(p?.shipping_enabled ?? p?.shippingEnabled ?? p?.requires_shipping)
  const hasShippingSignals =
    shippingEnabled ||
    p?.shipping_fee !== null ||
    p?.shipping_fee_currency !== null ||
    p?.estimated_delivery_days !== null ||
    p?.weight !== null ||
    p?.dimensions !== null
  if (hasShippingSignals) return "physical"

  // Media: if it looks like a downloadable file/link, treat as digital.
  if (Array.isArray(p?.media)) {
    for (const m of p.media) {
      const url = String(m?.url || "")
      if (!url) continue
      if (looksLikeDigitalUrl(url)) return "digital"
      // if later you store media.type = "file" or "download", pick it up
      const mt = normalizeType(m?.type)
      if (mt === "digital") return "digital"
    }
  }

  const desc = String(p?.description || p?.short_description || "")
  if (desc) {
    if (hasAnyKeyword(desc, ["ebook", "e-book", "template", "mau", "file", "tải", "tai", "code", "source", "link"])) {
      return "digital"
    }
    if (hasAnyKeyword(desc, ["voucher", "mã", "ma", "đổi mã", "doi ma", "dịch vụ", "dich vu", "lịch", "lich", "đặt lịch", "dat lich"])) {
      return "voucher"
    }
  }

  // Default safe fallback: physical (keeps legacy behavior and avoids breaking UI).
  return "physical"
}
