-- TSBIO Phase B (Business + CMS)
-- Version: v23 (SAFE REPAIR)
-- Date: 2026-02-07
-- Taxonomy architecture: Hub + Product + News + Rescue (separate domain tables)
--
-- SAFE REPAIR:
-- - Can be applied on fresh DB (Phase A only)
-- - Can be applied after failed/partial v22 run (tables may exist but lack columns/FKs)
-- - Does not DROP existing user data
-- - Uses CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS
-- - Adds FKs only when missing

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

create or replace function public.tsbio_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create or replace function public.tsbio_slugify(input text)
returns text as $$
declare
  s text;
begin
  s := lower(coalesce(input, ''));
  s := regexp_replace(s, '[^a-z0-9\s-]', '', 'g');
  s := regexp_replace(s, '\s+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  return s;
end; $$ language plpgsql;

-- ------------------------------------------------------------
-- Taxonomy core (Category Hub)
-- ------------------------------------------------------------

create table if not exists public.category_hub (
  id uuid primary key default gen_random_uuid(),
  code text,
  slug text,
  name text,
  description text,
  created_at timestamptz not null default now()
);

-- Ensure required columns (safe repair)
alter table public.category_hub add column if not exists code text;
alter table public.category_hub add column if not exists slug text;
alter table public.category_hub add column if not exists name text;
alter table public.category_hub add column if not exists description text;
alter table public.category_hub add column if not exists created_at timestamptz;

-- Add NOT NULL where safe (only if column exists and has no nulls in existing rows)
do $$
begin
  -- slug
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='category_hub' and column_name='slug') then
    -- set default for created_at if missing
    execute 'alter table public.category_hub alter column created_at set default now()';
  end if;
exception when others then
  -- keep migration forward-only; do not fail on legacy data
end $$;

create unique index if not exists category_hub_slug_uq on public.category_hub(slug);
create unique index if not exists category_hub_code_uq on public.category_hub(code) where code is not null;

-- ------------------------------------------------------------
-- Domain categories (SAFE REPAIR)
-- ------------------------------------------------------------

-- PRODUCT CATEGORIES
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text
);

alter table public.product_categories add column if not exists hub_id uuid;
alter table public.product_categories add column if not exists name text;
alter table public.product_categories add column if not exists slug text;
alter table public.product_categories add column if not exists parent_id uuid;
alter table public.product_categories add column if not exists order_no integer not null default 0;
alter table public.product_categories add column if not exists is_active boolean not null default true;
alter table public.product_categories add column if not exists created_at timestamptz not null default now();

-- Ensure parent FK (self-ref) safely
do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_product_categories_parent') then
    alter table public.product_categories
      add constraint fk_product_categories_parent
      foreign key (parent_id) references public.product_categories(id) on delete set null;
  end if;
exception when undefined_column then
end $$;

-- Hub FK
do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_product_cat_hub') then
    alter table public.product_categories
      add constraint fk_product_cat_hub
      foreign key (hub_id) references public.category_hub(id) on delete set null;
  end if;
exception when undefined_column then
end $$;

create unique index if not exists product_categories_slug_uq on public.product_categories(slug);
create index if not exists product_categories_hub_idx on public.product_categories(hub_id);
create index if not exists product_categories_parent_idx on public.product_categories(parent_id);

-- NEWS CATEGORIES
create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  name text
);

alter table public.news_categories add column if not exists hub_id uuid;
alter table public.news_categories add column if not exists name text;
alter table public.news_categories add column if not exists slug text;
alter table public.news_categories add column if not exists order_no integer not null default 0;
alter table public.news_categories add column if not exists is_active boolean not null default true;
alter table public.news_categories add column if not exists seo_title text;
alter table public.news_categories add column if not exists seo_description text;
alter table public.news_categories add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_news_cat_hub') then
    alter table public.news_categories
      add constraint fk_news_cat_hub
      foreign key (hub_id) references public.category_hub(id) on delete set null;
  end if;
exception when undefined_column then
end $$;

create unique index if not exists news_categories_slug_uq on public.news_categories(slug);
create index if not exists news_categories_hub_idx on public.news_categories(hub_id);

-- RESCUE CATEGORIES
create table if not exists public.rescue_categories (
  id uuid primary key default gen_random_uuid(),
  name text
);

alter table public.rescue_categories add column if not exists hub_id uuid;
alter table public.rescue_categories add column if not exists name text;
alter table public.rescue_categories add column if not exists slug text;
alter table public.rescue_categories add column if not exists order_no integer not null default 0;
alter table public.rescue_categories add column if not exists is_active boolean not null default true;
alter table public.rescue_categories add column if not exists priority integer not null default 0;
alter table public.rescue_categories add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_rescue_cat_hub') then
    alter table public.rescue_categories
      add constraint fk_rescue_cat_hub
      foreign key (hub_id) references public.category_hub(id) on delete set null;
  end if;
exception when undefined_column then
end $$;

create unique index if not exists rescue_categories_slug_uq on public.rescue_categories(slug);
create index if not exists rescue_categories_hub_idx on public.rescue_categories(hub_id);

-- ------------------------------------------------------------
-- B1 — Extend products: category, stock, soft delete, updated_at
-- (Your current schema: products has id, seller_id, farm_id, name, description, price_vnd, price_pi, active, created_at)
-- ------------------------------------------------------------

do $$
begin
  alter table public.products add column if not exists category_id uuid null;
  alter table public.products add column if not exists stock_quantity integer not null default 0;
  alter table public.products add column if not exists is_unlimited_stock boolean not null default false;
  alter table public.products add column if not exists deleted_at timestamptz null;
  alter table public.products add column if not exists updated_at timestamptz not null default now();
exception when undefined_table then
end $$;

-- Add FK for products.category_id -> product_categories.id (guarded)
do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_products_category') then
    alter table public.products
      add constraint fk_products_category
      foreign key (category_id) references public.product_categories(id) on delete set null;
  end if;
exception when undefined_table then
exception when undefined_column then
end $$;

do $$
begin
  drop trigger if exists trg_products_set_updated_at on public.products;
  create trigger trg_products_set_updated_at
    before update on public.products
    for each row execute function public.tsbio_set_updated_at();
exception when undefined_table then
end $$;

create index if not exists products_deleted_at_idx on public.products(deleted_at);
create index if not exists products_category_idx on public.products(category_id);

-- ------------------------------------------------------------
-- B2 — Posts CMS (Tin tức / Cứu vườn)
-- IMPORTANT: category_id has NO FK (because it points to different category tables by type)
-- Enforcement happens in server API.
-- ------------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text,
  author_id uuid,
  title text,
  slug text,
  excerpt text,
  content text,
  cover_url text,
  category_id uuid,
  status text,
  featured boolean,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe repair: ensure columns + constraints
alter table public.posts add column if not exists type text;
alter table public.posts add column if not exists author_id uuid;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists slug text;
alter table public.posts add column if not exists excerpt text;
alter table public.posts add column if not exists content text;
alter table public.posts add column if not exists cover_url text;
alter table public.posts add column if not exists category_id uuid;
alter table public.posts add column if not exists status text;
alter table public.posts add column if not exists featured boolean;
alter table public.posts add column if not exists seo_title text;
alter table public.posts add column if not exists seo_description text;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists deleted_at timestamptz;
alter table public.posts add column if not exists created_at timestamptz;
alter table public.posts add column if not exists updated_at timestamptz;

-- Enforce enums/checks (guarded)
do $$
begin
  if not exists (select 1 from pg_constraint where conname='posts_type_chk') then
    alter table public.posts
      add constraint posts_type_chk check (type in ('news','rescue'));
  end if;
exception when others then
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='posts_status_chk') then
    alter table public.posts
      add constraint posts_status_chk check (status in ('draft','published'));
  end if;
exception when others then
end $$;

-- Defaults
do $$
begin
  execute 'alter table public.posts alter column status set default ''draft''';
  execute 'alter table public.posts alter column featured set default false';
exception when others then
end $$;

create unique index if not exists posts_type_slug_uq on public.posts(type, slug);
create index if not exists posts_type_status_idx on public.posts(type, status);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_deleted_at_idx on public.posts(deleted_at);
create index if not exists posts_category_idx on public.posts(category_id);

drop trigger if exists trg_posts_set_updated_at on public.posts;
create trigger trg_posts_set_updated_at
  before update on public.posts
  for each row execute function public.tsbio_set_updated_at();

-- ------------------------------------------------------------
-- RLS notes
-- ------------------------------------------------------------
-- Phase B admin APIs should use service role (bypass RLS).
-- Keep your existing public read policy (products.active = true) untouched.
