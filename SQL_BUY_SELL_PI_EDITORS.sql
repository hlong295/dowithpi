-- SQL_BUY_SELL_PI_EDITORS.sql
-- Adds allowlist editors for updating Pi buy/sell prices (VND)
-- Safe to run multiple times.

alter table public.app_settings
  add column if not exists pi_exchange_editor_ids uuid[] default '{}'::uuid[];

-- Optional: store a dedicated timestamp for Pi exchange price updates (fallback uses updated_at)
alter table public.app_settings
  add column if not exists pi_exchange_updated_at timestamptz;
