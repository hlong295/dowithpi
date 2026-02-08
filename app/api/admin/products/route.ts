import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";

const PRODUCT_FIELDS = [
  "seller_id",
  "farm_id",
  "category_id",
  "name",
  "description",
  "price_vnd",
  "price_pi",
  "active",
  "stock_quantity",
  "is_unlimited_stock",
  "deleted_at",
] as const;

function pickProductPatch(body: any) {
  const patch: Record<string, any> = {};
  for (const k of PRODUCT_FIELDS) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  return patch;
}

export async function GET(req: Request) {
  // Root full, Provider allowed (they can manage products). Editor is not.
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const kind = (url.searchParams.get("kind") || "all").trim(); // all | farm | tsbio
  const includeDeleted = url.searchParams.get("deleted") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const admin = getSupabaseAdmin();
  let query = admin.from("products").select("*").order("created_at", { ascending: false }).limit(limit);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (kind === "farm") query = query.not("farm_id", "is", null);
  if (kind === "tsbio") query = query.is("farm_id", null);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_PRODUCTS_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.products.list",
    meta: { q: q || null, kind, includeDeleted, limit },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.name) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const patch = pickProductPatch(body);
  // Seller ownership rules
  // - Root can create/update on behalf of any seller_id
  // - Provider can only write seller_id = self
  const isRoot = (guard.profile.role || "") === "root_admin";
  const requestedSellerId = (patch.seller_id || "").toString().trim();
  if (requestedSellerId && !isRoot && requestedSellerId !== guard.userId) {
    return NextResponse.json({ error: "FORBIDDEN_SELLER_ID", detail: "provider cannot set seller_id for other users" }, { status: 403 });
  }
  if (!requestedSellerId) patch.seller_id = guard.userId;

  const { data, error } = await admin.from("products").insert(patch).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_PRODUCTS_CREATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.products.create",
    target: { type: "products", id: data?.id },
    meta: { patch },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
