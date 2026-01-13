export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public endpoint (read-only) for Buy/Sell Pi page.
// Returns ONLY active experts, grouped by category.
// Uses service-role on the server to avoid RLS/client-key issues.

const CATEGORY_VALUES = ["KYC_MAINNET", "PI_NODE", "PI_NETWORK"] as const;

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: rows, error } = await supabaseAdmin
      .from("pi_buy_sell_experts")
      .select(
        "id,category,username,full_name,phone,chat_apps,chat_handle,pricing_type,price_pi,price_pitd,note,is_active,updated_at"
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "query_failed", detail: error.message },
        { status: 500 }
      );
    }

    const grouped: Record<string, any[]> = {
      KYC_MAINNET: [],
      PI_NODE: [],
      PI_NETWORK: [],
    };

    (rows || []).forEach((r: any) => {
      const cat = String(r?.category || "").toUpperCase();
      if ((CATEGORY_VALUES as any).includes(cat)) grouped[cat].push(r);
    });

    return NextResponse.json({ ok: true, experts: grouped });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "unexpected", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
