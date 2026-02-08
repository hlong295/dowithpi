import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireRootAdmin } from "@/lib/admin/require-root";
import { writeAuditLog } from "@/lib/admin/audit";

export async function GET(req: Request) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("system_rules").select("*").order("key", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "ADMIN_RULES_READ_FAILED", detail: error.message }, { status: 500 });
  }
  await writeAuditLog({ actorId: root.userId, action: "admin.rules.list" }).catch(() => null);
  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const body = (await req.json().catch(() => ({}))) as { key?: string; value?: any };
  const key = (body?.key || "").trim();
  if (!key) return NextResponse.json({ error: "MISSING_KEY" }, { status: 400 });

  const admin = getSupabaseAdmin();
  // system_rules schema may vary; we assume (key text primary key, value jsonb/text)
  const payload: any = { key, value: body?.value ?? null };
  const { error } = await admin.from("system_rules").upsert(payload, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: "ADMIN_RULES_UPSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: root.userId,
    action: "admin.rules.upsert",
    target: { type: "system_rules", id: key },
    meta: { key },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
