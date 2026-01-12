-- PITODO: Pi Support Experts configuration
-- Goal: Root/Admin selects app members to display on /support as "Pioneer uy tín".
-- NOTE: This table is read/written ONLY via server APIs using service-role.

create table if not exists public.pi_support_experts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text null,
  areas text[] not null default '{}',
  charge_mode text not null default 'FREE', -- FREE | PI | PITD | BOTH
  price_pi numeric null,
  price_pitd numeric null,
  note text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pi_support_experts_user_id_idx on public.pi_support_experts(user_id);
create index if not exists pi_support_experts_active_idx on public.pi_support_experts(is_active);

-- Keep updated_at fresh
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pi_support_experts_updated_at on public.pi_support_experts;
create trigger trg_pi_support_experts_updated_at
before update on public.pi_support_experts
for each row execute function public.set_updated_at();

-- (Optional) Enable RLS for safety; server uses service-role anyway.
alter table public.pi_support_experts enable row level security;

-- No public policies by default. Data is exposed ONLY by server endpoint /api/pi-support/experts.
