import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireRootAdmin } from "@/lib/admin/require-root";
import { writeAuditLog } from "@/lib/admin/audit";

const ALLOWED_ROLES = ["member", "provider", "editor", "approval", "root_admin"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const body = await req.json().catch(() => null);
  const role = (body?.role || "").toString().trim();
  if (!role || !ALLOWED_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "INVALID_ROLE", detail: `allowed=${ALLOWED_ROLES.join(",")}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Root protection: cannot downgrade the primary root identity by mistake.
  const { data: current, error: curErr } = await admin.from("profiles").select("id,username,email,role").eq("id", ctx.params.id).maybeSingle();
  if (curErr) {
    return NextResponse.json({ error: "ADMIN_USER_GET_FAILED", detail: curErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if ((current.role || "") === "root_admin" && role !== "root_admin") {
    return NextResponse.json({ error: "ROOT_PROTECTION", detail: "Cannot downgrade a root_admin via API" }, { status: 403 });
  }

  const { data, error } = await admin.from("profiles").update({ role }).eq("id", ctx.params.id).select("id,username,email,role,level,created_at,updated_at").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "ADMIN_USER_UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: root.userId,
    action: "admin.users.set_role",
    target: { type: "profiles", id: ctx.params.id },
    meta: { from: current.role || null, to: role },
  }).catch(() => null);

  return NextResponse.json({ ok: true, item: data });
}
