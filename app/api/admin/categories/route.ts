import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";
import { slugify } from "@/lib/slug";

type Kind = "hub" | "product" | "news" | "rescue";

const TABLE_BY_KIND: Record<Kind, string> = {
  hub: "category_hub",
  product: "product_categories",
  news: "news_categories",
  rescue: "rescue_categories",
};

function getKindFromUrl(url: URL): Kind {
  // Back-compat: older UI used ?type=product|news|rescue
  const kind = (url.searchParams.get("kind") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const v = (kind || type || "product").toLowerCase();
  if (v === "hub") return "hub";
  if (v === "news") return "news";
  if (v === "rescue") return "rescue";
  return "product";
}

export async function GET(req: Request) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const url = new URL(req.url);
  const kind = getKindFromUrl(url);
  const hubId = (url.searchParams.get("hub_id") || "").trim();
  const admin = getSupabaseAdmin();

  const table = TABLE_BY_KIND[kind];

  let query = admin.from(table).select("*").order("created_at", { ascending: false });
  // hub_id filter only for domain category tables
  if (hubId && kind !== "hub") query = query.eq("hub_id", hubId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_CATEGORIES_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.categories.list",
    meta: { kind, hubId: hubId || null },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name && !body?.slug && !body?.code) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const kind = ((body?.kind || body?.type || "product") as string).toLowerCase();
  const k: Kind = (kind === "hub" ? "hub" : kind === "news" ? "news" : kind === "rescue" ? "rescue" : "product");
  const table = TABLE_BY_KIND[k];

  // Build insert patch by kind
  const name = (body?.name || "").trim();
  const inputSlug = (body?.slug || "").trim();
  const hubId = (body?.hub_id || "").trim() || null;
  const code = (body?.code || "").trim() || null;

  const slug = inputSlug ? slugify(inputSlug) : slugify(name || code || "item");

  let patch: Record<string, any> = {};
  if (k === "hub") {
    patch = {
      code,
      name: name || slug,
      slug,
      description: body?.description || null,
    };
  } else if (k === "product") {
    patch = {
      hub_id: hubId,
      name: name || slug,
      slug,
      parent_id: body?.parent_id || null,
      order_no: body?.order_no ?? 0,
      is_active: body?.is_active ?? true,
    };
  } else if (k === "news") {
    patch = {
      hub_id: hubId,
      name: name || slug,
      slug,
      order_no: body?.order_no ?? 0,
      is_active: body?.is_active ?? true,
      seo_title: body?.seo_title || null,
      seo_description: body?.seo_description || null,
    };
  } else {
    patch = {
      hub_id: hubId,
      name: name || slug,
      slug,
      order_no: body?.order_no ?? 0,
      is_active: body?.is_active ?? true,
      priority: body?.priority ?? 0,
    };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from(table).insert(patch).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_CATEGORIES_CREATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.categories.create",
    target: { type: table, id: data?.id },
    meta: { kind: k, patch },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
