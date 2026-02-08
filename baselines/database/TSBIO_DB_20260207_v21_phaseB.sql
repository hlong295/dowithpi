-- TSBIO Phase B (Business + CMS)
-- Version: v21
-- Date: 2026-02-07
-- NOTE: This is a forward migration script to apply on your Supabase/Postgres.
-- It is safe to re-run: uses IF NOT EXISTS / guarded ALTER blocks.

-- ------------------------------------------------------------
-- B1 — Product Management: categories, stock, soft delete
-- ------------------------------------------------------------

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  type text not null check (type in ('product','news','rescue')),
  created_at timestamptz not null default now()
);

create unique index if not exists product_categories_type_slug_uq on public.product_categories(type, slug);

do $$ begin
  alter table public.products add column if not exists category_id uuid null references public.product_categories(id);
  alter table public.products add column if not exists stock_quantity numeric not null default 0;
  alter table public.products add column if not exists is_unlimited_stock boolean not null default false;
  alter table public.products add column if not exists deleted_at timestamptz null;
  alter table public.products add column if not exists updated_at timestamptz not null default now();
exception when undefined_table then
  -- products table not present in this DB
end $$;

-- keep updated_at fresh
create or replace function public.tsbio_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

do $$ begin
  drop trigger if exists trg_products_set_updated_at on public.products;
  create trigger trg_products_set_updated_at
  before update on public.products
  for each row execute function public.tsbio_set_updated_at();
exception when undefined_table then
end $$;

-- ------------------------------------------------------------
-- B2 — Content CMS: posts (Tin tức / Cứu vườn), draft, SEO, soft delete
-- ------------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('news','rescue')),
  title text not null,
  slug text not null,
  excerpt text,
  content text,
  cover_url text,
  category_id uuid null references public.product_categories(id),
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

drop trigger if exists trg_posts_set_updated_at on public.posts;
create trigger trg_posts_set_updated_at
before update on public.posts
for each row execute function public.tsbio_set_updated_at();

-- ------------------------------------------------------------
-- B4 — Business audit helpers (optional): re-use audit_logs
-- ------------------------------------------------------------
-- No new tables required: code writes to public.audit_logs via writeAuditLog().

-- ------------------------------------------------------------
-- RLS notes
-- ------------------------------------------------------------
-- Service role bypasses RLS. If you want admin/editor/provider access via anon/auth roles,
-- add explicit policies later. For now, Phase B APIs are server-only and require Admin role.
