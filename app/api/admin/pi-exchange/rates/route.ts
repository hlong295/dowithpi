import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user"

export const dynamic = "force-dynamic"

async function ensureAppSettingsRow(supabase: any) {
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle()
  if (!error && data) return data

  // Minimal defaults (match existing code patterns). Do NOT reference columns that may not exist.
  const { data: inserted, error: insErr } = await supabase
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
    })
    .select("*")
    .single()

  if (insErr) throw new Error((insErr as any)?.message || "INSERT_APP_SETTINGS_FAILED")
  return inserted
}


async function canUpdateRates(supabase: any, requesterId: string) {
  // 1) Admin role
  try {
    const u: any = await requireAdmin(requesterId);
    if (u) return { ok: true };
  } catch {
    // ignore
  }

  // 2) Allowlisted member ids (set by root admin)
  const { data, error } = await supabase
    .from("app_settings")
    .select("pi_exchange_editor_ids")
    .limit(1)
    .maybeSingle();

  if (error) {
    // If column missing, treat as not allowed.
    return { ok: false, reason: "EDITORS_COLUMN_MISSING" };
  }

  const ids: any = (data as any)?.pi_exchange_editor_ids;
  const list: string[] = Array.isArray(ids) ? ids.filter((v) => typeof v === "string") : [];
  const allowed = list.includes(requesterId);
  return { ok: allowed, reason: allowed ? undefined : "NOT_IN_ALLOWLIST" };
}

function toNumberOrNull(v: any) {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return isFinite(n) ? n : null
  }
  return null
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient()

    const requesterId = await getAuthenticatedUserId(req)
    if (!requesterId) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Bạn chưa đăng nhập." }, { status: 401 })
    }

    // Allowed: admin OR designated member (allowlist set by root admin).
    const perm = await canUpdateRates(supabase, requesterId)
    if (!perm.ok) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Bạn không có quyền cập nhật giá.", debug: perm.reason }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const buy = toNumberOrNull(body?.buy_price_vnd)
    const sell = toNumberOrNull(body?.sell_price_vnd)

    await ensureAppSettingsRow(supabase)

    const { data, error } = await supabase
      .from("app_settings")
      .update({
        pi_buy_price_vnd: buy,
        pi_sell_price_vnd: sell,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .select("pi_buy_price_vnd, pi_sell_price_vnd, updated_at")
      .limit(1)
      .maybeSingle()

    if (error) {
      const msg = String((error as any)?.message || "")
      if (msg.includes("pi_buy_price_vnd") || msg.includes("pi_sell_price_vnd") || msg.includes("column")) {
        return NextResponse.json(
          {
            ok: false,
            code: "PI_RATES_COLUMNS_MISSING",
            message:
              "Thiếu cột giá Pi trong app_settings. Hãy chạy SQL migration để thêm cột pi_buy_price_vnd / pi_sell_price_vnd.",
            hint:
              "ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS pi_buy_price_vnd numeric; ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS pi_sell_price_vnd numeric;",
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: false, code: "DB_ERROR", message: msg }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      buy_price_vnd: (data as any)?.pi_buy_price_vnd ?? null,
      sell_price_vnd: (data as any)?.pi_sell_price_vnd ?? null,
      updated_at: (data as any)?.updated_at ?? null,
    })
  } catch (e: any) {
    const msg = String(e?.message || "UNKNOWN_ERROR")
    const status = msg.includes("FORBIDDEN") ? 403 : 500
    return NextResponse.json({ ok: false, code: "ERROR", message: msg }, { status })
  }
}
