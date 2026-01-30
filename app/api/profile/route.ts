import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest, isRootAdmin } from "@/lib/lottery/auth";

/**
 * GET /api/profile
 * - default: returns profile for authenticated user
 * - root admin can query a target user via ?userId=<uuid> OR ?pi_username=<name>
 *
 * NOTE: PITD is internal -> wallet data is read server-side.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: requesterId, username: requesterUsername } = await getUserFromRequest(request);
    const url = new URL(request.url);

    const targetUserIdParam = url.searchParams.get("userId") || undefined;
    const targetPiUsernameParam = url.searchParams.get("pi_username") || undefined;

    const requesterIsRoot = isRootAdmin({ username: requesterUsername });

    const supabaseAdmin = getSupabaseAdminClient();

    // Resolve target user id
    let targetUserId = requesterId;

    if ((targetUserIdParam || targetPiUsernameParam) && requesterIsRoot) {
      if (targetUserIdParam) {
        targetUserId = targetUserIdParam;
      } else if (targetPiUsernameParam) {
        const { data: u, error: uErr } = await supabaseAdmin
          .from("pi_users")
          .select("id")
          .eq("pi_username", targetPiUsernameParam)
          .maybeSingle();
        if (uErr) throw uErr;
        if (u?.id) targetUserId = u.id;
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("pi_users")
      .select(
        "id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved, provider_verified, provider_trusted, provider_status, provider_business_name, provider_business_description, created_at, updated_at"
      )
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ ok: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("pitd_wallets")
      .select("id, user_id, balance, locked_balance, total_spent, address")
      .eq("user_id", targetUserId)
      .maybeSingle();

    // wallet can be missing; do not fail profile
    if (walletError) {
      return NextResponse.json({
        ok: true,
        profile,
        wallet: null,
        debug: {
          requesterId,
          targetUserId,
          walletError: walletError.message ?? String(walletError),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      profile,
      wallet: wallet ?? null,
      debug: { requesterId, targetUserId, requesterIsRoot },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "PROFILE_LOAD_FAILED",
        detail: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
