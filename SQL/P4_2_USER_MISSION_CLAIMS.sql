-- P4.2 Daily missions (Earn) - anti-abuse claim ledger
-- Idempotent: safe to run multiple times.

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.user_mission_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mission_key text not null,
  claim_date date not null,
  pitd_tx_id uuid null references public.pitd_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One claim per mission per day
create unique index if not exists user_mission_claims_unique
  on public.user_mission_claims (user_id, mission_key, claim_date);

-- Helpful for lookups
create index if not exists user_mission_claims_user_date
  on public.user_mission_claims (user_id, claim_date desc);

-- RLS: only server (service role) should read/write
alter table public.user_mission_claims enable row level security;

-- Remove any old permissive policies if they exist
drop policy if exists "user_mission_claims_select" on public.user_mission_claims;
drop policy if exists "user_mission_claims_insert" on public.user_mission_claims;
drop policy if exists "user_mission_claims_update" on public.user_mission_claims;
drop policy if exists "user_mission_claims_delete" on public.user_mission_claims;

-- No anon/auth policies: PITD is server-only.

-- Allow service_role to operate
grant select, insert, update, delete on table public.user_mission_claims to service_role;
grant usage on schema public to service_role;
