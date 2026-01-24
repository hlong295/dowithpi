import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Internal helper route used by edit forms to load full product details.
// Uses service role (admin client) to avoid client-side RLS issues while still
// enforcing requester permission.

export const dynamic = "force-dynamic";

function isRootAdmin(piUsername?: string | null) {
  return (piUsername || "").toLowerCase() === "hlong295";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const productId = String(id || "").trim();
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Determine admin privileges from pi_users.
    const { data: requesterPi, error: requesterPiErr } = await supabase
      .from("pi_users")
      .select("id, pi_username, user_role")
      .eq("id", requesterId)
      .maybeSingle();

    if (requesterPiErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "REQUESTER_LOOKUP_FAILED",
          detail: requesterPiErr.message,
        },
        { status: 500 }
      );
    }

    const isAdmin =
      isRootAdmin(requesterPi?.pi_username) ||
      (requesterPi?.user_role || "").toLowerCase() === "admin";

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (productErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_FETCH_FAILED", detail: productErr.message },
        { status: 500 }
      );
    }
    if (!product) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Permission check: admins can load anything; providers can load their own.
    if (!isAdmin) {
      const providerId = String((product as any).provider_id || "");
      if (!providerId || providerId !== requesterId) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ ok: true, product });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
