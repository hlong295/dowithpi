import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireRootAdmin } from "@/lib/admin/require-root";
import { writeAuditLog } from "@/lib/admin/audit";

export async function GET(req: Request) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const admin = getSupabaseAdmin();
  let query = admin
    .from("profiles")
    .select("id, username, email, role, level, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(`username.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_USERS_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: root.userId,
    action: "admin.users.list",
    meta: { q: q || null, limit },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}
