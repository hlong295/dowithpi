import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

// Public endpoint: read-only Pi buy/sell prices (VND) from app_settings.
// If DB columns are missing, return ok=true with reason so UI can show placeholders safely.
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from("app_settings")
      .select("pi_buy_price_vnd, pi_sell_price_vnd, updated_at")
      .limit(1)
      .maybeSingle()

    if (error) {
      const msg = String((error as any)?.message || "")
      // Missing columns is common on fresh DBs.
      if (msg.includes("pi_buy_price_vnd") || msg.includes("pi_sell_price_vnd") || msg.includes("column")) {
        return NextResponse.json({
          ok: true,
          buy_price_vnd: null,
          sell_price_vnd: null,
          updated_at: null,
          reason: "COLUMNS_MISSING",
        })
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }

    const anyData: any = data || {}
    return NextResponse.json({
      ok: true,
      buy_price_vnd: anyData?.pi_buy_price_vnd ?? null,
      sell_price_vnd: anyData?.pi_sell_price_vnd ?? null,
      updated_at: anyData?.updated_at ?? null,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    )
  }
}
