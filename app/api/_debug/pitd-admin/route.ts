import { NextResponse } from "next/server"
import { getAdminKeyDebugInfo, getSupabaseAdminClient } from "@/lib/supabase/admin"

// Debug endpoint (safe for Pi Browser screenshots): shows whether the server has Service Role configured.
// Does NOT leak the key.
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.from("pitd_wallets").select("id").limit(1)
    return NextResponse.json({ ok: !error, pitd_wallets_access: error ? String((error as any).message || error) : true, debug: getAdminKeyDebugInfo() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), debug: getAdminKeyDebugInfo() }, { status: 500 })
  }
}
