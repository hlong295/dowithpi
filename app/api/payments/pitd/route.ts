export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getAdminKeyDebugInfo,
  getSupabaseAdminClient,
  validateServiceRoleKeyAgainstProject,
} from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

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
    "CREATE OR REPLACE FUNCTION public.pitd_purchase(",
    "  p_buyer_id uuid,",
    "  p_amount numeric,",
    "  p_product_id uuid,",
    "  p_note text DEFAULT NULL",
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
    "  ) VALUES (
    "    tx_id, w.id, 'purchase', -p_amount, new_balance, p_product_id::text, 'product',",
    "    COALESCE(p_note, 'PITODO exchange'),",
    "    jsonb_build_object('product_id', p_product_id, 'amount', p_amount),",
    "    NOW()",
    "  );",
    "",
    "  RETURN jsonb_build_object(
    "    'ok', true,
    "    'wallet_id', w.id,
    "    'new_balance', new_balance,
    "    'tx_id', tx_id
    "  );",
    "END;",
    "$$;",
    "",
    "GRANT EXECUTE ON FUNCTION public.pitd_purchase(uuid, numeric, uuid, text) TO authenticated;",
    "GRANT EXECUTE ON FUNCTION public.pitd_purchase(uuid, numeric, uuid, text) TO anon;",
    "",
    "-- Lưu ý: Supabase KHÔNG cho ALTER ROLE service_role (reserved role) nên đừng chạy ALTER ROLE ... BYPASSRLS.",
  ];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PitdPurchaseBody;

    const productId = body.productId || "";
    const userId = body.userId || "";
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
    const debugBase = getAdminKeyDebugInfo();

    // Validate that the service role key really matches the project (helps catch wrong key quickly)
    const keyValidation = await validateServiceRoleKeyAgainstProject();

    // Resolve master user id (important for Pi user + Email user consistency)
    const masterUserId = await resolveMasterUserId(supabaseAdmin, userId);

    // IMPORTANT: We DO NOT perform any direct SELECT/UPDATE on pitd_wallets here anymore,
    // because DB-level REVOKE/GRANT can block even service_role in some projects.
    // Instead we call a SECURITY DEFINER RPC (pitd_purchase) that runs with owner privileges.

    const note = `PITODO exchange - ${body.productName || "product"} (${productId})`;

    const { data, error } = await supabaseAdmin.rpc("pitd_purchase", {
      p_buyer_id: masterUserId,
      p_amount: expectedAmount * quantity,
      p_product_id: productId,
      p_note: note,
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

    return json({ ok: true, result: data, masterUserId });
  } catch (e: any) {
    return json({ message: e?.message || "Unknown error" }, 500);
  }
}
