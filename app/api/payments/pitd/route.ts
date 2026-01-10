export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getAdminKeyDebugInfo,
  getSupabaseAdminClient,
  validateServiceRoleKeyAgainstProject,
} from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

/**
 * PITD exchange must be server-only:
 * - Client NEVER touches pitd_wallets / pitd_transactions with anon key.
 * - All PITD goes through this API route.
 */

type PitdPurchaseBody = {
  productId?: string;
  userId?: string;
  expectedAmount?: number | string;
  productName?: string;
  quantity?: number;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksLikeUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function buildSqlHintForRpc(): string[] {
  return [
    "-- (1) OPTIONAL: Nếu bạn muốn tiếp tục dùng service_role truy vấn trực tiếp pitd_wallets/pitd_transactions",
    "--     (chạy bằng role postgres trong Supabase SQL Editor)",
    "GRANT USAGE ON SCHEMA public TO service_role;",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pitd_wallets TO service_role;",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pitd_transactions TO service_role;",
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;",
    "",
    "-- (2) FIX TRIỆT ĐỂ khi DB đã REVOKE/GRANT rối và service_role vẫn bị chặn:",
    "--     Tạo RPC SECURITY DEFINER (server gọi), KHÔNG cần service_role truy cập trực tiếp bảng.",
    "--     Chạy toàn bộ block dưới đây 1 lần (role postgres):",
    "",
    "-- Ensure gen_random_uuid",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "",
    "-- (Khuyến nghị) đảm bảo mỗi user chỉ có 1 ví",
    "DO $$ BEGIN",
    "  IF NOT EXISTS (",
    "    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='pitd_wallets_user_id_key'",
    "  ) THEN",
    "    BEGIN",
    "      CREATE UNIQUE INDEX pitd_wallets_user_id_key ON public.pitd_wallets(user_id);",
    "    EXCEPTION WHEN others THEN",
    "      -- ignore if constraint/index already exists with a different name",
    "      NULL;",
    "    END;",
    "  END IF;",
    "END $$;",
    "",
    "-- LƯU Ý QUAN TRỌNG: PostgREST/Supabase RPC match theo TÊN + THỨ TỰ tham số.",
    "-- App hiện đang gọi: pitd_purchase(p_amount, p_buyer_id, p_note, p_product_id)",
    "-- Vì vậy function phải khai báo đúng y chang thứ tự bên dưới.",
    "CREATE OR REPLACE FUNCTION public.pitd_purchase(",
    "  p_amount numeric,",
    "  p_buyer_id uuid,",
    "  p_note text,",
    "  p_product_id uuid",
    ")",
    "RETURNS jsonb",
    "LANGUAGE plpgsql",
    "SECURITY DEFINER",
    "SET search_path = public",
    "AS $$",
    "DECLARE",
    "  w record;",
    "  new_balance numeric;",
    "  tx_id uuid;",
    "BEGIN",
    "  IF p_amount IS NULL OR p_amount <= 0 THEN",
    "    RAISE EXCEPTION 'INVALID_AMOUNT';",
    "  END IF;",
    "",
    "  -- Ensure wallet exists",
    "  INSERT INTO public.pitd_wallets (user_id, balance, locked_balance, total_spent, address)",
    "  VALUES (p_buyer_id, 0, 0, 0, 'PITD' || substr(replace(gen_random_uuid()::text,'-',''), 1, 20))",
    "  ON CONFLICT (user_id) DO NOTHING;",
    "",
    "  SELECT * INTO w FROM public.pitd_wallets WHERE user_id = p_buyer_id FOR UPDATE;",
    "  IF w.id IS NULL THEN",
    "    RAISE EXCEPTION 'WALLET_NOT_FOUND';",
    "  END IF;",
    "",
    "  IF COALESCE(w.balance, 0) < p_amount THEN",
    "    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';",
    "  END IF;",
    "",
    "  new_balance := COALESCE(w.balance, 0) - p_amount;",
    "  UPDATE public.pitd_wallets",
    "    SET balance = new_balance,",
    "        total_spent = COALESCE(total_spent, 0) + p_amount,",
    "        updated_at = NOW()",
    "  WHERE id = w.id;",
    "",
    "  tx_id := gen_random_uuid();",
    "  INSERT INTO public.pitd_transactions (",
    "    id, wallet_id, transaction_type, amount, balance_after, reference_id, reference_type, description, metadata, created_at",
    "  ) VALUES (",
    "    tx_id, w.id, 'product_redeem', -p_amount, new_balance, p_product_id, 'product',",
    "    COALESCE(p_note, 'PITODO exchange'),",
    "    jsonb_build_object('product_id', p_product_id, 'amount', p_amount),",
    "    NOW()",
    "  );",
    "",
    "  RETURN jsonb_build_object(",
    "    'ok', true,",
    "    'wallet_id', w.id,",
    "    'new_balance', new_balance,",
    "    'tx_id', tx_id",
    "  );",
    "END;",
    "$$;",
    "",
    "-- Đảm bảo function thuộc owner postgres (tránh owner không có quyền trên PITD tables):",
    "ALTER FUNCTION public.pitd_purchase(numeric, uuid, text, uuid) OWNER TO postgres;",
    "REVOKE ALL ON FUNCTION public.pitd_purchase(numeric, uuid, text, uuid) FROM PUBLIC;",
    "GRANT EXECUTE ON FUNCTION public.pitd_purchase(numeric, uuid, text, uuid) TO service_role;",
    "GRANT EXECUTE ON FUNCTION public.pitd_purchase(numeric, uuid, text, uuid) TO authenticated;",
    "",
    "-- Lưu ý: Supabase KHÔNG cho ALTER ROLE service_role (reserved role) nên đừng chạy ALTER ROLE ... BYPASSRLS.",
  ];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PitdPurchaseBody;

    const productId = body.productId || "";
    // IMPORTANT: Never trust client-provided userId for PITD operations.
    // Pi Browser client payloads can contain Pi Network UID (pi_uid) which is NOT the master UUID.
    // Always derive the authenticated user from server-side cookies/session.
    const clientUserId = body.userId || "";
    // IMPORTANT: derive authenticated user from the incoming request.
    // Passing req is required; otherwise getAuthenticatedUserId will throw (req is undefined)
    // and Pi Browser will only show a generic "reading 'headers'" client error.
    const requesterId = await getAuthenticatedUserId(req);
    const userId = requesterId || "";
    const expectedAmount = asNumber(body.expectedAmount);
    const quantity = typeof body.quantity === "number" ? body.quantity : 1;

    if (!expectedAmount || expectedAmount <= 0) {
      return json({ message: "INVALID_PITD_AMOUNT" }, 400);
    }
    if (!productId) {
      return json({ message: "NO_PRODUCT" }, 400);
    }
    if (!userId) {
      return json({ message: "USER_NOT_FOUND" }, 400);
    }

    // Supabase admin client (service role)
    const supabaseAdmin = getSupabaseAdminClient();

    // Debug info (safe)
    const debugBase = {
      ...getAdminKeyDebugInfo(),
      requesterId,
      clientUserId,
    };

    // Validate that the service role key really matches the project (helps catch wrong key quickly)
    const keyValidation = await validateServiceRoleKeyAgainstProject();

    // Resolve master user id (important for Pi user + Email user consistency)
    // NOTE: Pi Browser sometimes sends/keeps a Supabase Auth UUID in cookies while
    // the true identity is the Pi username / Pi UID. So we always pass pi identity
    // hints to avoid writing purchases under the wrong UUID.
    const { piUserId: reqPiUserId, piUsername: reqPiUsername } =
      getPiIdentityFromRequest(req);
    let piUidForResolve: string | undefined = undefined;
    let piUsernameForResolve: string | undefined = reqPiUsername || undefined;

    if (reqPiUserId && !looksLikeUuid(reqPiUserId)) {
      // treat as Pi Network UID
      piUidForResolve = reqPiUserId;
    }

    const masterUserId = await resolveMasterUserId(
      supabaseAdmin,
      userId,
      piUidForResolve,
      piUsernameForResolve
    );

    // IMPORTANT: We DO NOT perform any direct SELECT/UPDATE on pitd_wallets here anymore,
    // because DB-level REVOKE/GRANT can block even service_role in some projects.
    // Instead we call a SECURITY DEFINER RPC (pitd_purchase) that runs with owner privileges.

    const note = `PITODO exchange - ${body.productName || "product"} (${productId})`;

    const { data, error } = await supabaseAdmin.rpc("pitd_purchase", {
      // Keep the same param order as the DB function signature:
      // pitd_purchase(p_amount, p_buyer_id, p_note, p_product_id)
      p_amount: expectedAmount * quantity,
      p_buyer_id: masterUserId.userId,
      p_note: note,
      p_product_id: productId,
    });

    if (error) {
      // Most common for your case: permission denied (if function not created yet)
      const msg = error?.message || String(error);
      const isPermissionDenied = /permission denied/i.test(msg);
      return json(
        {
          message: msg,
          code: isPermissionDenied
            ? "PITD_DB_PERMISSION_DENIED"
            : "PITD_PURCHASE_FAILED",
          hint: isPermissionDenied
            ? "DB đang chặn truy cập. Nếu bạn đã GRANT service_role mà vẫn lỗi, hãy tạo RPC SECURITY DEFINER pitd_purchase (SQL hint bên dưới)."
            : undefined,
          sql_hint: buildSqlHintForRpc(),
          debug: {
            ...debugBase,
            supabaseUrl: debugBase.supabaseUrl,
            keyValidation,
            masterUserId,
          },
        },
        500
      );
    }

    // 5) Record purchase history so Account -> "Sản phẩm đã mua" can display.
    //    (Pi payment flow already writes to user_purchases in /api/payments/complete.)
    //    Keep UI unchanged: only add missing server-side record here.
    const totalPrice = expectedAmount * quantity;
    const unitPrice = quantity > 0 ? totalPrice / quantity : totalPrice;

    const { error: purchaseErr } = await supabaseAdmin
      .from("user_purchases")
      .insert({
        user_id: masterUserId.userId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        payment_method: "pitd",
        status: "completed",
      });

    // Don't fail the whole request if purchase history insert fails (wallet already deducted).
    // Return a warning so we can debug on Pi Browser.
    if (purchaseErr) {
      return json(
        {
          ok: true,
          result: data,
          masterUserId,
          warning: "PITD_PURCHASE_OK_BUT_HISTORY_NOT_RECORDED",
          purchaseError: purchaseErr.message,
        },
        200
      );
    }

    return json({ ok: true, result: data, masterUserId });
  } catch (e: any) {
    return json({ message: e?.message || "Unknown error" }, 500);
  }
}
