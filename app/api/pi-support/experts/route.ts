export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Public endpoint (read-only): returns ONLY active experts.
// Uses service-role on the server to avoid RLS/client-key issues.

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: "missing_service_role_key" },
        { status: 500 }
      );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("pi_support_experts")
      .select(
        "id,user_id,display_name,areas,charge_mode,price_pi,price_pitd,note,is_active,updated_at"
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

    // Enrich display_name if missing using public.users/pi_users info.
    const userIds = (rows || [])
      .map((r: any) => r?.user_id)
      .filter((x: any) => typeof x === "string" && x);

    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id,full_name,pi_username,provider_business_name")
        .in("id", userIds);
      (users || []).forEach((u: any) => {
        userMap[String(u.id)] = u;
      });
    }

    const experts = (rows || []).map((r: any) => {
      const u = userMap[String(r.user_id)] || null;
      const fallbackName =
        (u?.provider_business_name as string) ||
        (u?.full_name as string) ||
        (u?.pi_username as string) ||
        null;
      return {
        ...r,
        display_name: r.display_name || fallbackName,
      };
    });

    return NextResponse.json({ ok: true, experts });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "unexpected", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
