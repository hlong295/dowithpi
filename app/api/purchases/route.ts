import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getPiIdentityFromRequest } from "@/lib/pitd/pi-identity";

function looksLikeUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

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
    // Resolve master users.id using Pi identity when available (Pi Browser often lacks Supabase session).
    // Prefer pi_username/pi_uid so we don't accidentally bind purchases to a transient auth uid.
    const { piUserId: reqPiUserId, piUsername: reqPiUsername } = getPiIdentityFromRequest(req);
    let piUid: string | null = null;
    let piUsername: string | null = reqPiUsername || null;

    // If request sends a non-uuid Pi UID in header/cookie, use it directly.
    if (reqPiUserId && !looksLikeUuid(reqPiUserId)) {
      piUid = reqPiUserId;
    }

    // Best effort: if we have a UUID that might be pi_users.id, fetch pi_uid/pi_username.
    // Try reqPiUserId first (if uuid), then fallback to userId.
    const candidatePiUuid = (reqPiUserId && looksLikeUuid(reqPiUserId))
      ? reqPiUserId
      : (looksLikeUuid(userId) ? userId : null);
    if (candidatePiUuid) {
      try {
        const { data: piRow } = await admin
          .from("pi_users")
          .select("pi_uid, pi_username")
          .eq("id", candidatePiUuid)
          .maybeSingle();
        if (piRow) {
          piUid = (piRow as any).pi_uid || piUid;
          piUsername = (piRow as any).pi_username || piUsername;
        }
      } catch {}
    }

    const master = await resolveMasterUserId(admin, userId, piUid, piUsername);
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
