-- TSBIO StageA / A1.1
-- Create app_settings table (simple key/value) to store public UI config (Hero headline, etc.)
-- Safe to run multiple times.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Auto-update timestamp
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

-- Seed defaults for Home HERO (used by A1.1)
insert into public.app_settings(key, value)
values
  ('home.hero.headline_top', 'TSBIO - ĐỒNG HÀNH CỨU VƯỜN'),
  ('home.hero.headline_bottom', 'HƠN 10.000 NHÀ VƯỜN\nPHỤC HỒI VƯỜN THÀNH CÔNG')
on conflict (key) do nothing;

-- NOTE (Phase A):
-- RLS/policies are intentionally not set here yet. Use your existing DB baseline/policies approach
-- once Admin Settings UI is ready.
