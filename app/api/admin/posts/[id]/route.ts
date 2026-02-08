import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";

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

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["editor"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from(TABLE).select("*").eq("id", ctx.params.id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_POSTS_GET_FAILED", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["editor"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const patch = pick(body);
  const admin = getSupabaseAdmin();

  // Validate category_id by post type (no FK at DB level)
  const needsType = patch.type !== undefined || patch.category_id !== undefined;
  if (needsType) {
    const { data: current, error: curErr } = await admin.from(TABLE).select("id,type,category_id").eq("id", ctx.params.id).maybeSingle();
    if (curErr) {
      return NextResponse.json({ error: "ADMIN_POSTS_GET_FAILED", detail: curErr.message }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const nextType = (patch.type || current.type || "news") as string;
    const nextCatId = (patch.category_id ?? current.category_id ?? "")?.toString().trim();
    if (nextCatId) {
      const catTable = nextType === "rescue" ? "rescue_categories" : "news_categories";
      const { data: cat, error: catErr } = await admin.from(catTable).select("id").eq("id", nextCatId).maybeSingle();
      if (catErr) {
        return NextResponse.json({ error: "ADMIN_POSTS_CATEGORY_CHECK_FAILED", detail: catErr.message }, { status: 500 });
      }
      if (!cat) {
        return NextResponse.json({ error: "INVALID_CATEGORY", detail: `category_id not found in ${catTable}` }, { status: 400 });
      }
    }
  }

  const { data, error } = await admin.from(TABLE).update(patch).eq("id", ctx.params.id).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_POSTS_UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.posts.update",
    target: { type: TABLE, id: ctx.params.id },
    meta: { patch },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireAdminRole(req, ["editor"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), status: "draft" })
    .eq("id", ctx.params.id)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_POSTS_DELETE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.posts.soft_delete",
    target: { type: TABLE, id: ctx.params.id },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
