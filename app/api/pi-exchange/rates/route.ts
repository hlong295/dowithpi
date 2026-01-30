import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

// Public endpoint: read-only Pi buy/sell prices (VND) from app_settings.
// Also returns viewer permissions (can_edit_prices, can_manage_editors) based on auth cookies.
// If DB columns are missing, return ok=true with reason so UI can show placeholders safely.

const ROOT_ADMIN_USERNAMES = ["hlong295"];

async function ensureAppSettingsRow(supabase: any) {
  // Defensive: app_settings can have multiple rows and column names may vary across deployments.
  // We avoid querying unknown columns in SQL (which would error) and instead:
  // 1) fetch a small recent window
  // 2) pick the first row that contains non-null Pi exchange values under any known alias
  // 3) fall back to the latest row
  const CAND_BUY = ["pi_buy_price_vnd", "pi_buy_vnd", "pi_buy_price", "pi_buy", "buy_price_vnd", "buy_vnd"];
  const CAND_SELL = ["pi_sell_price_vnd", "pi_sell_vnd", "pi_sell_price", "pi_sell", "sell_price_vnd", "sell_vnd"];
  const CAND_UPDATED_AT = ["pi_exchange_updated_at", "pi_rate_updated_at", "pi_rates_updated_at", "updated_at", "created_at"];

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (!error && Array.isArray(data) && data.length) {
    const hasValue = (row: any) =>
      CAND_BUY.some((k) => row?.[k] !== null && row?.[k] !== undefined && row?.[k] !== "") ||
      CAND_SELL.some((k) => row?.[k] !== null && row?.[k] !== undefined && row?.[k] !== "");

    const picked = data.find(hasValue) || data[0];
    return picked;
  }

  // If table exists but no row, insert minimal defaults (do NOT reference optional columns)
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
  return [];
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdminClient();

    const settings = await ensureAppSettingsRow(supabase);

    const s: any = settings as any;

    const buy = (s?.pi_buy_price_vnd ?? s?.pi_buy_vnd ?? s?.pi_buy_price ?? s?.pi_buy ?? s?.buy_price_vnd ?? s?.buy_vnd ?? null) as any;
    const sell = (s?.pi_sell_price_vnd ?? s?.pi_sell_vnd ?? s?.pi_sell_price ?? s?.pi_sell ?? s?.sell_price_vnd ?? s?.sell_vnd ?? null) as any;

    // Prefer explicit timestamp if present; otherwise fall back to row updated_at.
    const updatedAt = (settings as any)?.pi_exchange_updated_at || (settings as any)?.updated_at || null;
    const updatedBy = (settings as any)?.pi_exchange_updated_by || null;

    // Resolve 'Cập nhật bởi' label (pi_username preferred, fallback to email).
    let updatedByLabel: string | null = null;
    if (updatedBy) {
      const { data: u1 } = await supabase
        .from("users")
        .select("email, pi_username")
        .eq("id", updatedBy)
        .maybeSingle();
      if (u1) {
        updatedByLabel = (u1 as any).pi_username || (u1 as any).email || null;
      } else {
        const { data: u2 } = await supabase
          .from("pi_users")
          .select("pi_username")
          .eq("id", updatedBy)
          .maybeSingle();
        updatedByLabel = (u2 as any)?.pi_username || null;
      }
    }

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
      updated_by_label: updatedByLabel,
      can_edit_prices: canEditPrices,
      can_manage_editors: canManageEditors,
      reason: missing ? "COLUMNS_MISSING" : missingEditors ? "EDITORS_COLUMN_MISSING" : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
