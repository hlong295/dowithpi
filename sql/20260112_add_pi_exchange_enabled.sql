-- Add server-controlled toggle for Pi exchange block
-- Safe to run multiple times.
alter table if exists public.app_settings
  add column if not exists pi_exchange_enabled boolean not null default false;

-- Optional: ensure a row exists (if your app already inserts one, you can skip)
insert into public.app_settings (service_fee_percentage, tax_percentage, pitd_service_fee_percentage, pitd_tax_percentage, pi_exchange_enabled)
select 2, 8, 10, 8, false
where not exists (select 1 from public.app_settings);
