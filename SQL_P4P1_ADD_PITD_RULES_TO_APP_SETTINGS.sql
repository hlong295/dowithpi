-- P4.1 PITD Rules: add rule columns to public.app_settings (1-row config)
-- Safe to run multiple times.

alter table public.app_settings
  add column if not exists pitd_comment_fee numeric,
  add column if not exists pitd_review_fee numeric,
  add column if not exists pitd_boost_fee numeric,
  add column if not exists pitd_pi_to_pitd_rate numeric,
  add column if not exists pitd_topup_min numeric,
  add column if not exists pitd_topup_max numeric,
  add column if not exists pitd_transfer_enabled boolean,
  add column if not exists pitd_transfer_fee numeric,
  add column if not exists pitd_transfer_daily_limit numeric,
  add column if not exists pitd_transfer_weekly_limit numeric,
  add column if not exists pitd_transfer_max_per_tx numeric,
  add column if not exists pitd_transfer_cooldown_hours integer;

-- (Optional) initialize defaults on the existing row(s) when null
update public.app_settings
set
  pitd_comment_fee = coalesce(pitd_comment_fee, 0),
  pitd_review_fee = coalesce(pitd_review_fee, 0),
  pitd_boost_fee = coalesce(pitd_boost_fee, 0),
  pitd_pi_to_pitd_rate = coalesce(pitd_pi_to_pitd_rate, 1),
  pitd_topup_min = coalesce(pitd_topup_min, 0),
  pitd_topup_max = coalesce(pitd_topup_max, 0),
  pitd_transfer_enabled = coalesce(pitd_transfer_enabled, false),
  pitd_transfer_fee = coalesce(pitd_transfer_fee, 0),
  pitd_transfer_daily_limit = coalesce(pitd_transfer_daily_limit, 0),
  pitd_transfer_weekly_limit = coalesce(pitd_transfer_weekly_limit, 0),
  pitd_transfer_max_per_tx = coalesce(pitd_transfer_max_per_tx, 0),
  pitd_transfer_cooldown_hours = coalesce(pitd_transfer_cooldown_hours, 0);
