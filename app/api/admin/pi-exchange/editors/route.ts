export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Root admin allowlist (case-insensitive) to avoid lockout in edge cases.
const ROOT_ADMIN_USERNAMES = ["hlong295"];

function normStr(v: any) {
  return String(v || "").trim().toLowerCase();
}

async function isRootAdmin(sb: any, userId: string) {
  // Check public.users first
  try {
    const { data: u } = await sb.from("users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((u as any)?.user_role);
    const uname = normStr((u as any)?.pi_username || (u as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}

  // Fallback to pi_users
  try {
    const { data: p } = await sb.from("pi_users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((p as any)?.user_role);
    const uname = normStr((p as any)?.pi_username || (p as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}

  return false;
}

async function ensureAppSettingsRow(sb: any) {
  // app_settings is a singleton. Use id=1 deterministically to avoid reading a different row.
  const { data } = await sb.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (data) return data;

  // IMPORTANT: Always write id=1, otherwise Supabase will create a different row (id=2,3...)
  // and the app will "lose" settings (prices/editors) when it keeps reading id=1.
  const { data: inserted, error } = await sb
    .from("app_settings")
    .upsert(
      {
        id: 1,
        service_fee_percentage: 2,
        tax_percentage: 8,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) throw new Error((error as any)?.message || "INSERT_APP_SETTINGS_FAILED");
  return inserted;
}

function parseEditors(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  // Some DBs may store as jsonb string or comma-separated string.
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // fall through
    }
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const sb = getSupabaseAdminClient();
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

    if (!(await isRootAdmin(sb, requesterId))) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Chỉ Root Admin mới được quản lý quyền." }, { status: 403 });
    }

    const settings = await ensureAppSettingsRow(sb);

    if (!(settings as any)?.hasOwnProperty("pi_exchange_editor_ids")) {
      return NextResponse.json({
        ok: true,
        editors: [],
        reason: "EDITORS_COLUMN_MISSING",
        message: "DB chưa có cột pi_exchange_editor_ids. Hãy chạy SQL_BUY_SELL_PI_EDITORS.sql",
      });
    }

    const editorIds = parseEditors((settings as any)?.pi_exchange_editor_ids);

    // Enrich labels (best-effort). Some environments may have the user only in `pi_users`.
    let users: any[] = [];
    let piUsers: any[] = [];
    if (editorIds.length) {
      const [{ data: uData }, { data: pData }] = await Promise.all([
        sb.from("users").select("*").in("id", editorIds),
        sb.from("pi_users").select("*").in("id", editorIds),
      ]);
      users = (uData as any[]) || [];
      piUsers = (pData as any[]) || [];
    }

    const byId = new Map<string, any>();
    for (const u of piUsers) byId.set(String((u as any).id), u);
    for (const u of users) byId.set(String((u as any).id), u);

    const editors = editorIds.map((id) => {
      const u: any = byId.get(String(id));
      const label = u?.pi_username || u?.username || u?.email || String(id);
      return { user_id: String(id), label };
    });

    return NextResponse.json({ ok: true, editors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "ERROR", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseAdminClient();
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

    if (!(await isRootAdmin(sb, requesterId))) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Chỉ Root Admin mới được quản lý quyền." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();
    const targetUserId = String(body?.user_id || "").trim();

    if (!targetUserId) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Thiếu user_id." }, { status: 400 });
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ ok: false, code: "INVALID", message: "action phải là add/remove." }, { status: 400 });
    }

    const settings = await ensureAppSettingsRow(sb);

    if (!(settings as any)?.hasOwnProperty("pi_exchange_editor_ids")) {
      return NextResponse.json({
        ok: false,
        code: "EDITORS_COLUMN_MISSING",
        message: "DB chưa có cột pi_exchange_editor_ids. Hãy chạy SQL_BUY_SELL_PI_EDITORS.sql",
      }, { status: 400 });
    }

    const rowId = (settings as any)?.id;
    if (!rowId) {
      return NextResponse.json({ ok: false, code: "APP_SETTINGS_MISSING_ID", message: "Thiếu id trong app_settings." }, { status: 500 });
    }

    const current = parseEditors((settings as any)?.pi_exchange_editor_ids);
    const set = new Set(current);

    if (action === "add") set.add(targetUserId);
    if (action === "remove") set.delete(targetUserId);

    const next = Array.from(set);

    const { data, error } = await sb
      .from("app_settings")
      .update({ pi_exchange_editor_ids: next })
      .eq("id", rowId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, code: "UPDATE_FAILED", message: String((error as any)?.message || error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, editors: parseEditors((data as any)?.pi_exchange_editor_ids) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "ERROR", message: String(e?.message || e) }, { status: 500 });
  }
}
