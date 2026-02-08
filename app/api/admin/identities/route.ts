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
  const provider = (url.searchParams.get("provider") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const admin = getSupabaseAdmin();
  let query = admin
    .from("identities")
    .select("id, profile_id, provider, provider_uid, identity_data, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (provider) query = query.eq("provider", provider);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_IDENTITIES_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: root.userId,
    action: "admin.identities.list",
    meta: { provider: provider || null, limit },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}
