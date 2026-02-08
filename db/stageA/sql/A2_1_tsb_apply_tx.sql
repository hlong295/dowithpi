-- A2.1 — Balance engine + Ledger core (DB-side)
-- Atomic: updates tsb_wallets and inserts tsb_transactions.
-- Required for server API balance engine and rollback tool.

BEGIN;

-- Ensure wallet uniqueness: tsb_wallets(profile_id) unique already.

CREATE OR REPLACE FUNCTION public.tsb_apply_tx(
  p_profile_id uuid,
  p_amount numeric,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_tx_id uuid;
BEGIN
  -- Ensure wallet exists
  INSERT INTO public.tsb_wallets(profile_id, balance, locked)
  VALUES (p_profile_id, 0, 0)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Lock wallet row
  SELECT id, balance
  INTO v_wallet_id, v_balance
  FROM public.tsb_wallets
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_new_balance := coalesce(v_balance, 0) + coalesce(p_amount, 0);
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.tsb_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.tsb_transactions(
    wallet_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    metadata,
    created_at
  )
  VALUES (
    v_wallet_id,
    p_type,
    p_amount,
    v_new_balance,
    p_reference_type,
    p_reference_id,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'wallet_id', v_wallet_id,
    'balance', v_new_balance,
    'tx_id', v_tx_id
  );
END;
$$;

COMMIT;
