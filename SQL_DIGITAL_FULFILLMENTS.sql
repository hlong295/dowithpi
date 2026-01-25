-- P2.2 Digital goods fulfillment (giao ngay)
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.digital_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.user_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  access_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING | READY
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_fulfillments_user_id_idx ON public.digital_fulfillments(user_id);
CREATE INDEX IF NOT EXISTS digital_fulfillments_product_id_idx ON public.digital_fulfillments(product_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_digital_fulfillments()
RETURNS trigger
LANGUAGE plpgsql
AS $df$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$df$;

DROP TRIGGER IF EXISTS trg_digital_fulfillments_updated_at ON public.digital_fulfillments;
CREATE TRIGGER trg_digital_fulfillments_updated_at
BEFORE UPDATE ON public.digital_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_digital_fulfillments();

ALTER TABLE public.digital_fulfillments ENABLE ROW LEVEL SECURITY;

-- Buyer can read their own digital fulfillment.
DROP POLICY IF EXISTS df_owner_read ON public.digital_fulfillments;
CREATE POLICY df_owner_read ON public.digital_fulfillments
FOR SELECT
USING (auth.uid() = user_id);

-- No client insert/update policies.
-- Access to secret link is enforced through server API (service role).
