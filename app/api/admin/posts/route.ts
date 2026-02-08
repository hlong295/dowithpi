import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";
import { slugify } from "@/lib/slug";

const TABLE = "posts";

const POST_FIELDS = [
  "type",
  "title",
  "slug",
  "excerpt",
  "content",
  "cover_url",
  "category_id",
  "status",
  "seo_title",
  "seo_description",
  "featured",
  "published_at",
  "deleted_at",
] as const;

function pick(body: any) {
  const patch: Record<string, any> = {};
  for (const k of POST_FIELDS) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  return patch;
}

export async function GET(req: Request) {
  const guard = await requireAdminRole(req, ["editor"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "news").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const includeDeleted = url.searchParams.get("deleted") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const admin = getSupabaseAdmin();
  let query = admin.from(TABLE).select("*").eq("type", type).order("created_at", { ascending: false }).limit(limit);
  if (q) query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,slug.ilike.%${q}%`);
  if (!includeDeleted) query = query.is("deleted_at", null);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_POSTS_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.posts.list",
    meta: { type, q: q || null, includeDeleted, limit },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  const guard = await requireAdminRole(req, ["editor"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.type) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const patch = pick(body);
  patch.author_id = body.author_id || guard.userId;
  patch.status = patch.status || "draft";
  if (!patch.slug) patch.slug = slugify(String(patch.title || "post"));

  // Validate category_id by post type (no FK at DB level)
  const categoryId = (patch.category_id || "").toString().trim();
  if (categoryId) {
    const admin = getSupabaseAdmin();
    const catTable = patch.type === "rescue" ? "rescue_categories" : "news_categories";
    const { data: cat, error: catErr } = await admin.from(catTable).select("id").eq("id", categoryId).maybeSingle();
    if (catErr) {
      return NextResponse.json({ error: "ADMIN_POSTS_CATEGORY_CHECK_FAILED", detail: catErr.message }, { status: 500 });
    }
    if (!cat) {
      return NextResponse.json({ error: "INVALID_CATEGORY", detail: `category_id not found in ${catTable}` }, { status: 400 });
    }
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from(TABLE).insert(patch).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_POSTS_CREATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.posts.create",
    target: { type: TABLE, id: data?.id },
    meta: { patch },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
