-- Lucky Spin (Quay so trung thuong) tables
-- Run this in Supabase SQL Editor (public schema)
-- NOTE: PITD is server-only; these tables are meant to be accessed via server API routes using service_role.

-- Ensure UUID generator is available
create extension if not exists pgcrypto;

-- 1) Reward configuration
create table if not exists public.spin_rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reward_type text not null default 'PITD', -- PITD | PI | VOUCHER | NONE
  pitd_amount numeric(18,6) null,
  pi_amount numeric(18,6) null,
  voucher_label text null,
  weight numeric(18,6) not null default 1, -- relative probability
  is_active boolean not null default true,
  display_order int not null default 0,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spin_rewards_active_order
  on public.spin_rewards (is_active, display_order);

-- 2) Daily limits (per user/day + one global row)
create table if not exists public.spin_daily_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  limit_date date null,
  spins_used int not null default 0,
  max_spins int not null default 1,
  last_spin_at timestamptz null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique per user/day (only when user_id is not null)
create unique index if not exists uq_spin_daily_limits_user_day
  on public.spin_daily_limits(user_id, limit_date)
  where user_id is not null and limit_date is not null;

-- Exactly one global row: (user_id is null and limit_date is null)
create unique index if not exists uq_spin_daily_limits_global
  on public.spin_daily_limits((coalesce(user_id::text,'__global__')),(coalesce(limit_date::text,'__global__')))
  where user_id is null and limit_date is null;

-- 3) Spin logs
create table if not exists public.spin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reward_id uuid null references public.spin_rewards(id) on delete set null,
  reward_snapshot jsonb null,
  status text not null default 'created', -- applied | pending_contact | none | failed
  pitd_amount numeric(18,6) null,
  pi_amount numeric(18,6) null,
  idempotency_key text not null,
  client_fingerprint text null,
  claim_info jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_spin_logs_user_time
  on public.spin_logs(user_id, created_at desc);

create unique index if not exists uq_spin_logs_user_idem
  on public.spin_logs(user_id, idempotency_key);

-- Optional: seed default rewards (safe upserts)
insert into public.spin_rewards (title, reward_type, pitd_amount, weight, is_active, display_order)
values
  ('5 PITD', 'PITD', 5, 55, true, 10),
  ('10 PITD', 'PITD', 10, 25, true, 20),
  ('50 PITD', 'PITD', 50, 8, true, 30),
  ('100 PITD', 'PITD', 100, 2, true, 40),
  ('Voucher 0.1π', 'VOUCHER', null, 8, true, 50),
  ('Voucher 0.25π', 'VOUCHER', null, 2, true, 60),
  ('Chúc bạn may mắn lần sau', 'NONE', null, 20, true, 70)
on conflict do nothing;

-- Seed the global limit row (1 spin/day). Admin can edit on /lucky-spin
insert into public.spin_daily_limits (user_id, limit_date, spins_used, max_spins)
values (null, null, 0, 1)
on conflict do nothing;

-- Security: enable RLS and keep tables server-only (no policies by default)
alter table public.spin_rewards enable row level security;
alter table public.spin_daily_limits enable row level security;
alter table public.spin_logs enable row level security;

-- No policies are created here intentionally.
-- Access must go through server APIs using service_role.
