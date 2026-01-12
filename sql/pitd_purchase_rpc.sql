-- PITODO / PITD
-- Fix: allow server to deduct PITD without relying on direct table SELECT/UPDATE privileges.
-- Approach: SECURITY DEFINER RPC function owned by postgres.
-- Run this ONCE in Supabase SQL Editor (role: postgres).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Ensure pitd_wallets has 1 wallet per user (skip if you already have UNIQUE(user_id))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'pitd_wallets_user_id_key'
  ) THEN
    -- Create a UNIQUE index name that won't clash with an existing constraint name
    CREATE UNIQUE INDEX IF NOT EXISTS pitd_wallets_user_id_key ON public.pitd_wallets(user_id);
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'pitd_wallets table not found in schema public';
END $$;

-- 1) Core RPC: deduct PITD from buyer wallet + write transaction
CREATE OR REPLACE FUNCTION public.pitd_purchase(
  p_buyer_user_id uuid,
  p_amount numeric,
  p_product_id uuid,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_id uuid;
  w_balance numeric;
  w_locked numeric;
  new_balance numeric;
  tx_id uuid;
  address_text text;
BEGIN
  IF p_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'BUYER_NOT_FOUND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Ensure wallet exists
  address_text := 'PITD' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.pitd_wallets (user_id, balance, locked_balance, total_spent, address)
  VALUES (p_buyer_user_id, 0, 0, 0, address_text)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock wallet row
  SELECT id, balance, locked_balance
    INTO w_id, w_balance, w_locked
  FROM public.pitd_wallets
  WHERE user_id = p_buyer_user_id
  FOR UPDATE;

  IF w_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  w_balance := COALESCE(w_balance, 0);

  IF w_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  new_balance := w_balance - p_amount;

  UPDATE public.pitd_wallets
  SET balance = new_balance,
      total_spent = COALESCE(total_spent, 0) + p_amount,
      updated_at = NOW()
  WHERE id = w_id;

  tx_id := gen_random_uuid();

  INSERT INTO public.pitd_transactions (
    id,
    wallet_id,
    transaction_type,
    amount,
    balance_after,
    reference_id,
    reference_type,
    description,
    metadata,
    created_at
  ) VALUES (
    tx_id,
    w_id,
    'purchase',
    -p_amount,
    new_balance,
    COALESCE(p_product_id::text, NULL),
    'product',
    COALESCE(p_description, 'PITODO exchange'),
    jsonb_build_object(
      'product_id', p_product_id,
      'amount', p_amount
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tx_id', tx_id,
    'wallet_id', w_id,
    'new_balance', new_balance
  );
END;
$$;

-- 2) Allow server (service_role) and authenticated users to call it (server will call with service_role)
GRANT EXECUTE ON FUNCTION public.pitd_purchase(uuid, numeric, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pitd_purchase(uuid, numeric, uuid, text) TO authenticated;

-- (Optional) if you want anon to be able to call this (NOT recommended):
-- GRANT EXECUTE ON FUNCTION public.pitd_purchase(uuid, numeric, uuid, text) TO anon;
