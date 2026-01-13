import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

// Public endpoint: read-only Pi buy/sell prices (VND) from app_settings.
// Also returns `can_edit` for the CURRENT requester (if authenticated) based on:
// - Admin roles, OR
// - Allowlisted member ids in app_settings.pi_exchange_editor_ids
// Root-admin detection is conservative (role/root allowlist) on server.
async function computeCanEdit(supabase: any, requesterId: string | null, settingsRow: any) {
  if (!requesterId) return { can_edit: false, is_root_admin: false };

  // 1) Admin role (root_admin/admin/...)
  try {
    const u: any = await requireAdmin(requesterId);
    if (u) {
      const role = String(u?.user_role || "").toLowerCase();
      const isRoot = role === "root_admin" || role === "super_admin" || role === "system";
      return { can_edit: true, is_root_admin: isRoot };
    }
  } catch {
    // ignore
  }

  // 2) Allowlist (members designated by root admin)
  const ids: any = (settingsRow as any)?.pi_exchange_editor_ids;
  const list: string[] =
    Array.isArray(ids) ? ids.filter((v) => typeof v === "string") : [];

  const can = list.includes(requesterId);
  return { can_edit: can, is_root_admin: false };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("pi_buy_price_vnd, pi_sell_price_vnd, updated_at, pi_exchange_editor_ids")
      .limit(1)
      .maybeSingle();

    if (error) {
      const msg = String((error as any)?.message || "");
      // If any required column is missing, return safe placeholders for UI.
      if (msg.includes("pi_buy_price_vnd") || msg.includes("pi_sell_price_vnd") || msg.includes("column")) {
        return NextResponse.json({
          ok: true,
          buy_price_vnd: null,
          sell_price_vnd: null,
          updated_at: null,
          can_edit: false,
          is_root_admin: false,
          reason: "COLUMNS_MISSING",
        });
      }
      return NextResponse.json({ ok: false, error: msg || "DB_ERROR" }, { status: 500 });
    }

    // Best-effort identify requester (Pi Browser cookies / bearer token).
    const requesterId = await getAuthenticatedUserId(req as any).catch(() => null);
    const perm = await computeCanEdit(supabase, requesterId, data);

    const anyData: any = data || {};
    return NextResponse.json({
      ok: true,
      buy_price_vnd: anyData?.pi_buy_price_vnd ?? null,
      sell_price_vnd: anyData?.pi_sell_price_vnd ?? null,
      updated_at: anyData?.updated_at ?? null,
      can_edit: perm.can_edit,
      is_root_admin: perm.is_root_admin,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "UNKNOWN_ERROR" }, { status: 500 });
  }
}
