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

function pick(body: any) {
  const patch: Record<string, any> = {};
  for (const k of PRODUCT_FIELDS) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  return patch;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("products").select("*").eq("id", ctx.params.id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_PRODUCTS_GET_FAILED", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const patch = pick(body);
  const isRoot = (guard.profile.role || "") === "root_admin";
  const requestedSellerId = (patch.seller_id || "").toString().trim();
  if (requestedSellerId && !isRoot && requestedSellerId !== guard.userId) {
    return NextResponse.json({ error: "FORBIDDEN_SELLER_ID", detail: "provider cannot set seller_id for other users" }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("products").update(patch).eq("id", ctx.params.id).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_PRODUCTS_UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.products.update",
    target: { type: "products", id: ctx.params.id },
    meta: { patch },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const admin = getSupabaseAdmin();
  // Soft delete: set deleted_at if column exists. If not, fall back to active=false.
  const { data, error } = await admin
    .from("products")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", ctx.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    // fallback if deleted_at column doesn't exist
    const fallback = await admin.from("products").update({ active: false }).eq("id", ctx.params.id).select("*").maybeSingle();
    if (fallback.error) {
      return NextResponse.json({ error: "ADMIN_PRODUCTS_DELETE_FAILED", detail: fallback.error.message }, { status: 500 });
    }
    await writeAuditLog({
      actorId: guard.userId,
      action: "admin.products.soft_delete",
      target: { type: "products", id: ctx.params.id },
      meta: { mode: "active_false" },
    }).catch(() => null);
    return NextResponse.json({ ok: true, item: fallback.data });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.products.soft_delete",
    target: { type: "products", id: ctx.params.id },
    meta: { mode: "deleted_at" },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
