import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

export const dynamic = "force-dynamic";

// Server-only purchases API.
// Why: Pi Browser flow may not have a Supabase Auth session, so owner-only RLS
// on user_purchases will return empty if queried from client with anon key.
export async function GET(req: Request) {
  try {
    const { userId } = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdminClient();
    const master = await resolveMasterUserId(admin, userId);
    const masterId = master?.userId || userId;

    // Fetch purchases for this user. Keep selection conservative to match existing UI.
    const { data, error } = await admin
      .from("user_purchases")
      .select(
        "id, created_at, user_id, product_id, amount, currency, status, note, metadata"
      )
      .eq("user_id", masterId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          code: "PURCHASES_FETCH_FAILED",
          debug: { masterId },
        },
        { status: 500 }
      );
    }

    // Optional: hydrate basic product info for display (avoid breaking if join fails).
    const productIds = Array.from(
      new Set((data || []).map((p: any) => p.product_id).filter(Boolean))
    );

    let productsById: Record<string, any> = {};
    if (productIds.length > 0) {
      const { data: prods, error: prodErr } = await admin
        .from("products")
        .select(
          "id, name, title, image_url, thumbnail, price, price_pi, category, descriptions"
        )
        .in("id", productIds);

      if (!prodErr && prods) {
        for (const pr of prods as any[]) {
          productsById[String(pr.id)] = pr;
        }
      }
    }

    const items = (data || []).map((p: any) => ({
      ...p,
      product: productsById[String(p.product_id)] || null,
    }));

    return NextResponse.json({ ok: true, items, debug: { masterId } });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: e?.message || String(e),
        code: "PURCHASES_FETCH_FAILED",
      },
      { status: 500 }
    );
  }
}
