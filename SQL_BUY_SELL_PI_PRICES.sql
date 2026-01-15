-- Add Pi buy/sell price fields (VND) to app_settings
-- Safe to run multiple times.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pi_buy_price_vnd numeric;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pi_sell_price_vnd numeric;

-- Optional: if your app_settings has no updated_at auto-update trigger,
-- you can still rely on your existing triggers. No further changes required.
