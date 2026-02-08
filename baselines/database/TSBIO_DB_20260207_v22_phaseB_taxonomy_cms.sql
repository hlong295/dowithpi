-- TSBIO Phase B (Business + CMS)
-- Version: v22
-- Date: 2026-02-07
-- Taxonomy architecture: Hub + Product + News + Rescue (separate domain tables)
-- NOTE: Forward migration. Safe to re-run (IF NOT EXISTS + guarded ALTER).

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

create or replace function public.tsbio_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

-- Basic slugify (optional) - keep simple; can be replaced later
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
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists category_hub_slug_uq on public.category_hub(slug);
create unique index if not exists category_hub_code_uq on public.category_hub(code) where code is not null;

-- ------------------------------------------------------------
-- Domain categories
-- ------------------------------------------------------------

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid null references public.category_hub(id) on delete set null,
  name text not null,
  slug text not null,
  parent_id uuid null references public.product_categories(id) on delete set null,
  order_no integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists product_categories_slug_uq on public.product_categories(slug);
create index if not exists product_categories_hub_idx on public.product_categories(hub_id);
create index if not exists product_categories_parent_idx on public.product_categories(parent_id);

create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid null references public.category_hub(id) on delete set null,
  name text not null,
  slug text not null,
  order_no integer not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);

create unique index if not exists news_categories_slug_uq on public.news_categories(slug);
create index if not exists news_categories_hub_idx on public.news_categories(hub_id);

create table if not exists public.rescue_categories (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid null references public.category_hub(id) on delete set null,
  name text not null,
  slug text not null,
  order_no integer not null default 0,
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists rescue_categories_slug_uq on public.rescue_categories(slug);
create index if not exists rescue_categories_hub_idx on public.rescue_categories(hub_id);

-- ------------------------------------------------------------
-- B1 — Extend products: category, stock, soft delete, updated_at
-- (matches your current schema: products has id, seller_id, farm_id, name, description, price_vnd, price_pi, active, created_at)
-- ------------------------------------------------------------

do $$
begin
  alter table public.products add column if not exists category_id uuid null references public.product_categories(id);
  alter table public.products add column if not exists stock_quantity integer not null default 0;
  alter table public.products add column if not exists is_unlimited_stock boolean not null default false;
  alter table public.products add column if not exists deleted_at timestamptz null;
  alter table public.products add column if not exists updated_at timestamptz not null default now();
exception when undefined_table then
  -- products table not present
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
  type text not null check (type in ('news','rescue')),
  author_id uuid,
  title text not null,
  slug text not null,
  excerpt text,
  content text,
  cover_url text,
  category_id uuid,
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
-- Phase B APIs are server-only and use service role (bypass RLS).
-- Keep your existing public read policy (products.active = true) untouched.
