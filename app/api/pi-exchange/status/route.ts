import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    // app_settings is single-row settings table in this codebase
    const { data, error } = await supabase
      .from("app_settings")
      .select("pi_exchange_enabled, updated_at")
      .limit(1)
      .maybeSingle()

    // If column doesn't exist yet, default to disabled (safe)
    if (error) {
      const msg = String((error as any)?.message || "")
      if (msg.includes("pi_exchange_enabled") || msg.includes("column")) {
        return NextResponse.json({ ok: true, enabled: false, reason: "COLUMN_MISSING" })
      }
      return NextResponse.json({ ok: false, enabled: false, error: msg }, { status: 500 })
    }

    return NextResponse.json({ ok: true, enabled: !!(data as any)?.pi_exchange_enabled })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, enabled: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    )
  }
}
