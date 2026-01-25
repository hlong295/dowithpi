-- P3.2 (User post fee): add PITD post fee settings to app_settings.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS pitd_user_post_fee numeric,
  ADD COLUMN IF NOT EXISTS pitd_provider_post_fee numeric;

-- Defaults (you can change later in Admin UI)
UPDATE public.app_settings
SET
  pitd_user_post_fee = COALESCE(pitd_user_post_fee, 1),
  pitd_provider_post_fee = COALESCE(pitd_provider_post_fee, 0);
