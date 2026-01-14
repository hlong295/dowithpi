import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

// Public endpoint: read-only Pi buy/sell prices (VND) from app_settings.
// Also returns viewer permissions (can_edit_prices, can_manage_editors) based on auth cookies.
// If DB columns are missing, return ok=true with reason so UI can show placeholders safely.

const ROOT_ADMIN_USERNAMES = ["hlong295"];

async function ensureAppSettingsRow(supabase: any) {
  // app_settings is intended to be a singleton.
  // Always use id=1 if present to avoid different rows being read/updated.
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!error && data) return data;

  // Minimal defaults (match existing code patterns). Do NOT reference columns that may not exist.
  const { data: inserted, error: insErr } = await supabase
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
    })
    .select("*")
    .single();

  if (insErr) throw new Error((insErr as any)?.message || "INSERT_APP_SETTINGS_FAILED");
  return inserted;
}

function normStr(v: any) {
  return String(v || "").trim().toLowerCase();
}

async function isRootAdmin(supabase: any, userId: string) {
  try {
    const { data: u } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((u as any)?.user_role);
    const uname = normStr((u as any)?.pi_username || (u as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}

  // Fallback for Pi login deployments
  try {
    const { data: p } = await supabase.from("pi_users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((p as any)?.user_role);
    const uname = normStr((p as any)?.pi_username || (p as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}

  return false;
}

function parseEditors(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    // Accept JSON array string or comma-separated.
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {}
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdminClient();

    const settings = await ensureAppSettingsRow(supabase);

    const buy = (settings as any)?.pi_buy_price_vnd ?? null;
    const sell = (settings as any)?.pi_sell_price_vnd ?? null;

    // Prefer explicit timestamp if present; otherwise fall back to row updated_at.
    const updatedAt = (settings as any)?.pi_exchange_updated_at || (settings as any)?.updated_at || null;
    const updatedBy = (settings as any)?.pi_exchange_updated_by || null;

    // Viewer permissions
    const requesterId = await getAuthenticatedUserId(req);
    let canEditPrices = false;
    let canManageEditors = false;

    if (requesterId) {
      // Admin always allowed
      try {
        await requireAdmin(requesterId);
        canEditPrices = true;
      } catch {
        // not admin
      }

      // Allowlist editors (if column exists)
      const editorIds = parseEditors((settings as any)?.pi_exchange_editor_ids);
      if (editorIds.includes(requesterId)) {
        canEditPrices = true;
      }

      // Root can manage the editor list
      canManageEditors = await isRootAdmin(supabase, requesterId);
    }

    // If the DB is missing the columns, still return ok with reason.
    const missing =
      !(settings as any)?.hasOwnProperty("pi_buy_price_vnd") ||
      !(settings as any)?.hasOwnProperty("pi_sell_price_vnd");

    const missingEditors = !(settings as any)?.hasOwnProperty("pi_exchange_editor_ids");

    return NextResponse.json({
      ok: true,
      buy_price_vnd: buy,
      sell_price_vnd: sell,
      updated_at: updatedAt,
      updated_by: updatedBy,
      can_edit_prices: canEditPrices,
      can_manage_editors: canManageEditors,
      reason: missing ? "COLUMNS_MISSING" : missingEditors ? "EDITORS_COLUMN_MISSING" : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
