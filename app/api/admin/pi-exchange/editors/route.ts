export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Root admin allowlist (case-insensitive) to avoid lockout in edge cases.
const ROOT_ADMIN_USERNAMES = ["hlong295"];

async function isRootAdmin(supabaseAdmin: any, requesterId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,user_role,pi_username")
    .eq("id", requesterId)
    .maybeSingle();

  if (error) return false;
  const role = String(data?.user_role || "").toLowerCase();
  const uname = String(data?.pi_username || "").toLowerCase();
  if (role === "root_admin" || role === "super_admin" || role === "system") return true;
  if (uname && ROOT_ADMIN_USERNAMES.map((x) => x.toLowerCase()).includes(uname)) return true;
  return false;
}

async function getSettingsRow(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin.from("app_settings").select("*").limit(1).maybeSingle();
  if (!error && data) return { ok: true, data };

  // Insert minimal defaults (must not reference unknown columns)
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
      provider_application_fee: 0,
      provider_approval_required: true,
      min_pitd_transfer: 0,
    })
    .select("*")
    .limit(1)
    .maybeSingle();

  if (insErr) return { ok: false, error: String((insErr as any)?.message || "DB_ERROR") };
  return { ok: true, data: inserted };
}

async function loadEditors(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("pi_exchange_editor_ids")
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String((error as any)?.message || "");
    if (msg.includes("pi_exchange_editor_ids") || msg.includes("column")) {
      return { ok: false as const, code: "EDITORS_COLUMN_MISSING", message: "Thiếu cột pi_exchange_editor_ids trong app_settings." };
    }
    return { ok: false as const, code: "DB_ERROR", message: msg || "DB_ERROR" };
  }

  const ids: any = (data as any)?.pi_exchange_editor_ids;
  const list: string[] = Array.isArray(ids) ? ids.filter((v) => typeof v === "string") : [];
  return { ok: true as const, ids: list };
}

async function resolveIdentifierToUserId(supabaseAdmin: any, identifier: string) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;

  // UUID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(raw)) return raw;

  // Match by pi_username OR email OR username
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,pi_username,email,username,full_name")
    .or(`pi_username.eq.${raw},email.eq.${raw},username.eq.${raw}`)
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id;
  return null;
}

async function describeUsers(supabaseAdmin: any, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,pi_username,email,username,full_name")
    .in("id", ids);

  const rows: any[] = Array.isArray(data) ? data : [];
  // Preserve order
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id) || { id });
}

// GET: root-admin only, returns current allowlist
export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();

  const requesterId = await getAuthenticatedUserId(req as any);
  if (!requesterId) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const okRoot = await isRootAdmin(supabaseAdmin, requesterId);
  if (!okRoot) return NextResponse.json({ ok: false, code: "FORBIDDEN_NOT_ROOT_ADMIN" }, { status: 403 });

  // Ensure settings row exists (safe)
  await getSettingsRow(supabaseAdmin);

  const ed = await loadEditors(supabaseAdmin);
  if (!ed.ok) return NextResponse.json({ ok: false, code: ed.code, message: ed.message }, { status: 500 });

  const editors = await describeUsers(supabaseAdmin, ed.ids);
  return NextResponse.json({ ok: true, editors });
}

// POST: root-admin only, add/remove/set allowlist
export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();

  const requesterId = await getAuthenticatedUserId(req as any);
  if (!requesterId) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const okRoot = await isRootAdmin(supabaseAdmin, requesterId);
  if (!okRoot) return NextResponse.json({ ok: false, code: "FORBIDDEN_NOT_ROOT_ADMIN" }, { status: 403 });

  await getSettingsRow(supabaseAdmin);

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "add").toLowerCase();
  const identifier = String(body?.identifier || "").trim();
  const identifiers = Array.isArray(body?.identifiers) ? body.identifiers.map((x: any) => String(x || "").trim()).filter(Boolean) : [];

  const current = await loadEditors(supabaseAdmin);
  if (!current.ok) return NextResponse.json({ ok: false, code: current.code, message: current.message }, { status: 500 });

  let nextIds = [...current.ids];

  if (action === "set") {
    const resolved: string[] = [];
    for (const it of identifiers) {
      const id = await resolveIdentifierToUserId(supabaseAdmin, it);
      if (id) resolved.push(id);
    }
    nextIds = Array.from(new Set(resolved));
  } else if (action === "remove") {
    const id = await resolveIdentifierToUserId(supabaseAdmin, identifier);
    if (id) nextIds = nextIds.filter((x) => x !== id);
  } else {
    // add
    const id = await resolveIdentifierToUserId(supabaseAdmin, identifier);
    if (!id) return NextResponse.json({ ok: false, code: "USER_NOT_FOUND", message: "Không tìm thấy thành viên." }, { status: 400 });
    if (!nextIds.includes(id)) nextIds.push(id);
  }

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({ pi_exchange_editor_ids: nextIds });

  if (error) return NextResponse.json({ ok: false, code: "DB_ERROR", message: String((error as any)?.message || "DB_ERROR") }, { status: 500 });

  const editors = await describeUsers(supabaseAdmin, nextIds);
  return NextResponse.json({ ok: true, editors });
}
