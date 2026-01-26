-- P2.1 Voucher fulfillment (Professional services)
-- Goal: When a voucher is purchased (Pi or PITD), server creates a redeem code.
--       User can view the code in Order Detail; Provider/Admin can mark it USED.
--
-- Safe to run multiple times.

-- pgcrypto provides gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.voucher_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.user_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  redeem_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | USED
  used_at timestamptz NULL,
  used_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  used_note text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voucher_fulfillments_user_id_idx ON public.voucher_fulfillments(user_id);
CREATE INDEX IF NOT EXISTS voucher_fulfillments_product_id_idx ON public.voucher_fulfillments(product_id);

-- Keep updated_at fresh (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at_voucher_fulfillments()
RETURNS trigger
LANGUAGE plpgsql
AS $vf$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$vf$;

DROP TRIGGER IF EXISTS trg_voucher_fulfillments_updated_at ON public.voucher_fulfillments;
CREATE TRIGGER trg_voucher_fulfillments_updated_at
BEFORE UPDATE ON public.voucher_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_voucher_fulfillments();

-- RLS
ALTER TABLE public.voucher_fulfillments ENABLE ROW LEVEL SECURITY;

-- Owner (buyer) can view their own voucher fulfillment.
DROP POLICY IF EXISTS vf_owner_read ON public.voucher_fulfillments;
CREATE POLICY vf_owner_read ON public.voucher_fulfillments
FOR SELECT
USING (auth.uid() = user_id);

-- IMPORTANT:
-- Providers/Admin should NOT update directly from client. App updates via service role API.
-- Keep default: no INSERT/UPDATE/DELETE policies for authenticated.
