-- Add PITD payment mode + direct contact fields on products
-- When pitd_payment_enabled = false: product detail should show direct contact info instead of PITD exchange button.

alter table if exists public.products
  add column if not exists pitd_payment_enabled boolean not null default true;

alter table if exists public.products
  add column if not exists direct_contact_name text;

alter table if exists public.products
  add column if not exists direct_contact_phone text;

alter table if exists public.products
  add column if not exists direct_contact_address text;

alter table if exists public.products
  add column if not exists direct_contact_note text;
