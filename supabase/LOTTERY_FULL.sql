-- Dowithpi Lottery (Xổ số) tables & helpers
-- Run in Supabase SQL Editor (public schema)
-- NOTE: PITD is server-only; do not create permissive RLS policies for PITD-related writes.

create extension if not exists pgcrypto;

-- 0) Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 1) Events
create table if not exists public.lottery_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  open_at timestamptz not null,
  close_at timestamptz not null,
  draw_at timestamptz not null,
  max_participants int null,
  close_when_full boolean not null default false,
  status text not null default 'draft', -- draft|open|closed|drawing|completed|cancelled
  requires_pioneer boolean not null default false,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lottery_events_updated_at on public.lottery_events;
create trigger trg_lottery_events_updated_at
before update on public.lottery_events
for each row execute function public.set_updated_at();

create index if not exists idx_lottery_events_status_time
on public.lottery_events (status, open_at desc);

-- 2) Prizes (configurable per event)
create table if not exists public.lottery_prizes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lottery_events(id) on delete cascade,
  rank int not null,
  prize_type text not null, -- PI | PITD | VOUCHER
  amount numeric(18,6) null,
  label text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, rank)
);

drop trigger if exists trg_lottery_prizes_updated_at on public.lottery_prizes;
create trigger trg_lottery_prizes_updated_at
before update on public.lottery_prizes
for each row execute function public.set_updated_at();

create index if not exists idx_lottery_prizes_event
on public.lottery_prizes (event_id, rank);

-- 3) Entries (1 number per user per event, number unique per event)
create table if not exists public.lottery_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lottery_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  chosen_number int not null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  unique(event_id, user_id),
  unique(event_id, chosen_number)
);

-- Idempotency: allow repeated submits with the same key
create unique index if not exists uq_lottery_entries_idem
on public.lottery_entries (event_id, user_id, idempotency_key)
where idempotency_key is not null;

create index if not exists idx_lottery_entries_event
on public.lottery_entries (event_id, created_at desc);

-- 4) Draw commit–reveal (audit)
create table if not exists public.lottery_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lottery_events(id) on delete cascade,
  seed_hash text not null,
  seed_reveal text null,
  algorithm_version text not null default 'v1',
  draw_started_at timestamptz null,
  draw_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique(event_id)
);

-- 5) Winners
create table if not exists public.lottery_winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lottery_events(id) on delete cascade,
  rank int not null,
  user_id uuid not null references public.users(id) on delete cascade,
  chosen_number int not null,
  prize_type text not null,
  amount numeric(18,6) null,
  payout_status text not null default 'pending_contact', -- pending_contact|auto_paid|paid|rejected
  payout_ref text null,
  created_at timestamptz not null default now(),
  unique(event_id, rank)
);

create index if not exists idx_lottery_winners_event
on public.lottery_winners (event_id, rank);

-- 6) User claim info for PI/VOUCHER payouts
create table if not exists public.lottery_payout_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lottery_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rank int not null,
  full_name text null,
  phone text null,
  pi_wallet_address text null,
  note text null,
  status text not null default 'submitted', -- submitted|processing|paid|rejected
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

drop trigger if exists trg_lottery_payout_requests_updated_at on public.lottery_payout_requests;
create trigger trg_lottery_payout_requests_updated_at
before update on public.lottery_payout_requests
for each row execute function public.set_updated_at();

-- 7) Request log for server-side rate limiting (cheap DB-backed throttle)
create table if not exists public.lottery_api_requests (
  id bigserial primary key,
  user_id uuid null,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lottery_api_requests_user_time
on public.lottery_api_requests (user_id, created_at desc);

-- 8) Seed demo event (idempotent)
do $$
declare
  v_event_id uuid;
begin
  if not exists (select 1 from public.lottery_events limit 1) then
    insert into public.lottery_events
      (title, description, open_at, close_at, draw_at, max_participants, close_when_full, status, requires_pioneer, meta)
    values
      ('Xổ số may mắn', 'Chọn 1 số 0–9999. Quay minh bạch commit–reveal.', now(), now() + interval '1 day', now() + interval '1 day 1 hour',
       500, true, 'open', false, '{"ui":"mockup_v1"}')
    returning id into v_event_id;

    insert into public.lottery_prizes (event_id, rank, prize_type, amount, label, is_active)
    values
      (v_event_id, 1, 'PITD', 100, 'Hạng 1', true),
      (v_event_id, 2, 'PITD', 50,  'Hạng 2', true),
      (v_event_id, 3, 'PITD', 10,  'Hạng 3', true);

    insert into public.lottery_draws (event_id, seed_hash, algorithm_version)
    values (v_event_id, 'PENDING COMMIT BY SERVER', 'v1');
  end if;
end $$;

-- IMPORTANT:
-- - Do NOT add permissive RLS policies here.
-- - Server (service_role) will access these tables via API routes.
