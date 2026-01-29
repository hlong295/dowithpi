-- P4.1 PITD Rules schema migration
-- Idempotent: safe to run multiple times.
-- Adds PITD Rules columns to public.app_settings so /api/admin/pitd-rules can read/write.

-- This fixes runtime error like:
--   column app_settings.cost_post_product does not exist

alter table if exists public.app_settings
  add column if not exists cost_post_product        numeric,
  add column if not exists cost_comment             numeric,
  add column if not exists cost_review              numeric,
  add column if not exists cost_boost               numeric,
  add column if not exists pi_to_pitd_rate           numeric,
  add column if not exists topup_min_pi             numeric,
  add column if not exists topup_max_pi             numeric,
  add column if not exists transfer_policy_enabled  boolean,
  add column if not exists transfer_eligibility     text,
  add column if not exists transfer_limit_per_day   numeric,
  add column if not exists transfer_limit_per_week  numeric,
  add column if not exists transfer_max_per_tx      numeric,
  add column if not exists transfer_tx_per_day      integer,
  add column if not exists transfer_fee_pitd        numeric,
  add column if not exists transfer_cooldown_hours  integer;

-- Optional: if app_settings is empty, you may pre-create 1 row.
-- Only run this if your table allows inserting a row with just (id).
--
-- create extension if not exists pgcrypto;
-- insert into public.app_settings (id)
-- select gen_random_uuid()
-- where not exists (select 1 from public.app_settings);
