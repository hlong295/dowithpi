import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import {
  insertPitdTransaction,
  selectWalletByUserIds,
  updateWalletBalance,
} from "@/lib/pitd/ledger";

// P3.1: Provider must be approved to create products (server-side).
// Uses service role client but enforces permission checks manually.

export const dynamic = "force-dynamic";

function isRootAdmin(piUsername?: string | null) {
  return (piUsername || "").toLowerCase() === "hlong295";
}

export async function POST(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: requesterPi, error: requesterPiErr } = await supabase
      .from("pi_users")
      .select("id, pi_username, user_role, provider_approved")
      .eq("id", requesterId)
      .maybeSingle();

    if (requesterPiErr) {
      return NextResponse.json(
        { ok: false, error: "REQUESTER_LOOKUP_FAILED", detail: requesterPiErr.message },
        { status: 500 }
      );
    }

    const isAdmin =
      isRootAdmin(requesterPi?.pi_username) ||
      (requesterPi?.user_role || "").toLowerCase() === "admin";

    const isApprovedProvider = (requesterPi as any)?.provider_approved === true;

    // P3.2: Normal members can post products but must pay PITD post fee.
    // Approved providers may be free/discounted based on app_settings.
    let postFeeUser = 0;
    let postFeeProvider = 0;
    if (!isAdmin) {
      const { data: settingsRow, error: settingsErr } = await supabase
        .from("app_settings")
        .select("id, pitd_user_post_fee, pitd_provider_post_fee, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsErr) {
        return NextResponse.json(
          { ok: false, error: "APP_SETTINGS_READ_FAILED", detail: settingsErr.message },
          { status: 500 },
        );
      }

      // If columns aren't there yet, we must fail with a clear message.
      postFeeUser = Number((settingsRow as any)?.pitd_user_post_fee ?? NaN);
      postFeeProvider = Number((settingsRow as any)?.pitd_provider_post_fee ?? NaN);
      if (!Number.isFinite(postFeeUser) || !Number.isFinite(postFeeProvider)) {
        return NextResponse.json(
          {
            ok: false,
            error: "APP_SETTINGS_MISSING_POST_FEES",
            detail:
              "Missing pitd_user_post_fee / pitd_provider_post_fee in app_settings. Run SQL_P3P2_ADD_POST_FEES_TO_APP_SETTINGS.sql.",
          },
          { status: 500 },
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    // Non-admin cannot create on behalf of others.
    const providerIdFromBody = String((body as any).provider_id || "").trim();
    const providerIdToUse = isAdmin ? providerIdFromBody || requesterId : requesterId;

    // P3.2: PITD post fee for normal users. Providers may be free/discounted.
    // Fee settings live in app_settings (latest row by updated_at).
    let postFee = 0;
    if (!isAdmin) {
      const { data: settings, error: settingsErr } = await supabase
        .from("app_settings")
        .select("pitd_user_post_fee,pitd_provider_post_fee,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsErr) {
        return NextResponse.json(
          { ok: false, error: "APP_SETTINGS_LOAD_FAILED", detail: settingsErr.message },
          { status: 500 }
        );
      }

      const userFee = Number((settings as any)?.pitd_user_post_fee ?? NaN);
      const providerFee = Number((settings as any)?.pitd_provider_post_fee ?? NaN);

      if (!Number.isFinite(userFee) || !Number.isFinite(providerFee)) {
        return NextResponse.json(
          { ok: false, error: "POST_FEE_SETTINGS_MISSING" },
          { status: 500 }
        );
      }

      postFee = isApprovedProvider ? Math.max(0, providerFee) : Math.max(0, userFee);
    }

    const insertPayload = {
      ...(body as any),
      provider_id: providerIdToUse,
      // Safety: never allow client to set server-managed timestamps.
      created_at: undefined,
      updated_at: undefined,
    } as any;
    delete insertPayload.created_at;
    delete insertPayload.updated_at;

    const { data: created, error: insertErr } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_CREATE_FAILED", detail: insertErr.message },
        { status: 500 }
      );
    }

    // Charge PITD fee AFTER product creation; if charge fails, rollback product.
    if (postFee > 0 && !isAdmin) {
      try {
        const wallet = await selectWalletByUserIds(supabase, [requesterId]);
        if (!wallet?.id) {
          throw new Error("PITD_WALLET_NOT_FOUND");
        }

        const curBalance = Number((wallet as any)?.balance ?? 0);
        if (!Number.isFinite(curBalance)) throw new Error("PITD_BALANCE_INVALID");
        if (curBalance < postFee) throw new Error("PITD_INSUFFICIENT");

        const newBalance = Math.round((curBalance - postFee) * 1_000_000) / 1_000_000;
        await updateWalletBalance(supabase, wallet.id, newBalance);
        await insertPitdTransaction(supabase, {
          walletId: wallet.id,
          transactionType: "post_fee",
          amount: -postFee,
          balanceAfter: newBalance,
          description: "Phí đăng bài",
          referenceId: (created as any)?.id ? String((created as any).id) : null,
          referenceType: "product",
          metadata: {
            kind: "post_fee",
            provider_approved: isApprovedProvider,
          },
        });
      } catch (feeErr: any) {
        // rollback created product best-effort
        await supabase.from("products").delete().eq("id", (created as any)?.id);
        const msg = String(feeErr?.message || feeErr);
        const status = msg === "PITD_INSUFFICIENT" ? 402 : 400;
        return NextResponse.json(
          { ok: false, error: msg, debug: { postFee, requesterId } },
          { status }
        );
      }
    }

    return NextResponse.json({ ok: true, product: created });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
