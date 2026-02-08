import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";

// Providers are represented by `profiles` with role = 'provider'.

export async function GET(req: Request) {
  const guard = await requireAdminRole(req, ["provider"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error, detail: guard.detail }, { status: guard.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 200);

  const admin = getSupabaseAdmin();
  let query = admin
    .from("profiles")
    .select("id, username, full_name, phone, email, role, level, created_at, updated_at")
    .in("role", ["provider", "root_admin"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "ADMIN_PROVIDERS_READ_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: guard.userId,
    action: "admin.providers.list",
    meta: { q: q || null, limit },
  }).catch(() => null);

  return NextResponse.json({ ok: true, items: data || [] });
}
