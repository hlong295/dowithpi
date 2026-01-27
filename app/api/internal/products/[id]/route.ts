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

async function getRequesterRole(sb: ReturnType<typeof getSupabaseAdminClient>, requesterId: string) {
  const { data, error } = await sb
    .from("pi_users")
    .select("id, pi_username, user_role, provider_approved")
    .eq("id", requesterId)
    .maybeSingle();
  if (error) return { ok: false as const, error };
  const isAdmin =
    isRootAdmin((data as any)?.pi_username) ||
    String((data as any)?.user_role || "").toLowerCase() === "admin";
  const providerApproved = (data as any)?.provider_approved === true;
  return { ok: true as const, data, isAdmin, providerApproved };
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

    const requesterRole = await getRequesterRole(supabase, requesterId);
    if (!requesterRole.ok) {
      return NextResponse.json(
        { ok: false, error: "REQUESTER_LOOKUP_FAILED", detail: requesterRole.error.message },
        { status: 500 }
      );
    }
    const isAdmin = requesterRole.isAdmin;
    if (!isAdmin && !requesterRole.providerApproved) {
      // Provider must be approved to access edit/load of products.
      return NextResponse.json({ ok: false, error: "PROVIDER_NOT_APPROVED" }, { status: 403 });
    }

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const productId = String(id || "").trim();
    if (!productId) {
      return NextResponse.json({ ok: false, error: "MISSING_PRODUCT_ID" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const requesterRole = await getRequesterRole(supabase, requesterId);
    if (!requesterRole.ok) {
      return NextResponse.json(
        { ok: false, error: "REQUESTER_LOOKUP_FAILED", detail: requesterRole.error.message },
        { status: 500 }
      );
    }

    const isAdmin = requesterRole.isAdmin;
    if (!isAdmin && !requesterRole.providerApproved) {
      return NextResponse.json({ ok: false, error: "PROVIDER_NOT_APPROVED" }, { status: 403 });
    }

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, provider_id")
      .eq("id", productId)
      .maybeSingle();

    if (productErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_FETCH_FAILED", detail: productErr.message },
        { status: 500 }
      );
    }
    if (!product) {
      return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }

    if (!isAdmin) {
      const providerId = String((product as any).provider_id || "");
      if (!providerId || providerId !== requesterId) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    // Never allow changing ownership via this endpoint.
    const patch: any = { ...(body as any) };
    delete patch.provider_id;
    delete patch.created_at;
    delete patch.updated_at;

    // Admin can hide/show; provider can still edit their product fields.
    // If you want to restrict is_active toggles to admin only, uncomment below.
    // if (!isAdmin) delete patch.is_active;

    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await supabase
      .from("products")
      .update(patch)
      .eq("id", productId)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_UPDATE_FAILED", detail: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, product: updated });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const productId = String(id || "").trim();
    if (!productId) {
      return NextResponse.json({ ok: false, error: "MISSING_PRODUCT_ID" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const requesterRole = await getRequesterRole(supabase, requesterId);
    if (!requesterRole.ok) {
      return NextResponse.json(
        { ok: false, error: "REQUESTER_LOOKUP_FAILED", detail: requesterRole.error.message },
        { status: 500 }
      );
    }
    const isAdmin = requesterRole.isAdmin;

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, provider_id")
      .eq("id", productId)
      .maybeSingle();
    if (productErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_FETCH_FAILED", detail: productErr.message },
        { status: 500 }
      );
    }
    if (!product) {
      return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }

    if (!isAdmin) {
      if (!requesterRole.providerApproved) {
        return NextResponse.json({ ok: false, error: "PROVIDER_NOT_APPROVED" }, { status: 403 });
      }
      const providerId = String((product as any).provider_id || "");
      if (!providerId || providerId !== requesterId) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const { error: delErr } = await supabase.from("products").delete().eq("id", productId);
    if (delErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_DELETE_FAILED", detail: delErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
