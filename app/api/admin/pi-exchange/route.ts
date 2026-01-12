import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { getAuthenticatedUserId, resolveMasterUserId } from "@/lib/pitd/require-user"

export const dynamic = "force-dynamic"

const ROOT_ADMIN_USERNAMES = new Set(["hlong295"])

async function isRequesterAdmin(supabase: any, requesterId: string) {
  const masterUserId = await resolveMasterUserId(supabase, requesterId)

  const { data: u, error: uErr } = await supabase
    .from("users")
    .select("id, role, pi_username")
    .eq("id", masterUserId)
    .maybeSingle()

  if (uErr || !u) return { ok: false as const, masterUserId, user: null as any }
  const role = String((u as any).role || "").toLowerCase()
  const piUsername = String((u as any).pi_username || "").toLowerCase()
  const isAdmin = role === "admin" || role === "root_admin" || ROOT_ADMIN_USERNAMES.has(piUsername)
  return { ok: isAdmin, masterUserId, user: u }
}

async function ensureAppSettingsRow(supabase: any) {
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle()
  if (!error && data) return data

  // Minimal defaults (match existing code patterns)
  const { data: inserted, error: insErr } = await supabase
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
      pitd_service_fee_percentage: 10,
      pitd_tax_percentage: 8,
    })
    .select("*")
    .single()

  if (insErr) throw new Error((insErr as any)?.message || "INSERT_APP_SETTINGS_FAILED")
  return inserted
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient()

    const requesterId = await getAuthenticatedUserId(req)
    if (!requesterId) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Bạn chưa đăng nhập." }, { status: 401 })
    }

    const adminCheck = await isRequesterAdmin(supabase, requesterId)
    if (!adminCheck.ok) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Bạn không có quyền." }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const enabled = !!body?.enabled

    await ensureAppSettingsRow(supabase)

    const { data, error } = await supabase
      .from("app_settings")
      .update({ pi_exchange_enabled: enabled })
      .neq("id", "00000000-0000-0000-0000-000000000000") // update all rows if any
      .select("pi_exchange_enabled")
      .limit(1)
      .maybeSingle()

    if (error) {
      const msg = String((error as any)?.message || "")
      if (msg.includes("pi_exchange_enabled") || msg.includes("column")) {
        return NextResponse.json(
          {
            ok: false,
            code: "PI_EXCHANGE_COLUMN_MISSING",
            message:
              "Thiếu cột pi_exchange_enabled trong app_settings. Hãy chạy SQL migration để thêm cột.",
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: false, code: "DB_ERROR", message: msg }, { status: 500 })
    }

    return NextResponse.json({ ok: true, enabled: !!(data as any)?.pi_exchange_enabled })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: "UNKNOWN_ERROR", message: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    )
  }
}
