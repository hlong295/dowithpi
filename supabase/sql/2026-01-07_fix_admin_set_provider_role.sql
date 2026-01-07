-- Fix: admin_set_provider_role() raised "column reference \"id\" is ambiguous".
-- Replacement: qualify columns with table aliases; update both public.users (master) and public.pi_users.

create or replace function public.admin_set_provider_role(
  requester_id uuid,
  target_user_id uuid,
  make_provider boolean
)
returns table (
  id uuid,
  pi_username text,
  user_role text,
  provider_approved boolean,
  provider_approved_at timestamptz,
  provider_approved_by uuid,
  provider_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  req_role text;
begin
  select pu.user_role
    into req_role
  from public.pi_users pu
  where pu.id = requester_id;

  if req_role is null or req_role <> 'root_admin' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.users u where u.id = target_user_id) then
    raise exception 'Target user not found' using errcode = 'P0002';
  end if;

  -- Update PI-side flags if the user exists in pi_users
  if exists (select 1 from public.pi_users pu where pu.id = target_user_id) then
    if make_provider then
      update public.pi_users pu
        set user_role = 'provider',
            provider_approved = true,
            provider_approved_at = now_ts,
            provider_approved_by = requester_id,
            updated_at = now_ts
      where pu.id = target_user_id;
    else
      update public.pi_users pu
        set user_role = 'redeemer',
            provider_approved = false,
            provider_approved_at = null,
            provider_approved_by = null,
            updated_at = now_ts
      where pu.id = target_user_id;
    end if;
  end if;

  -- Update master users table
  if make_provider then
    update public.users u
      set is_provider = true,
          provider_status = 'approved',
          updated_at = now_ts
    where u.id = target_user_id;

    insert into public.provider_approvals(provider_id, approved_by, action, reason, created_at)
      values (target_user_id, requester_id, 'approved', null, now_ts);
  else
    update public.users u
      set is_provider = false,
          provider_status = 'none',
          updated_at = now_ts
    where u.id = target_user_id;

    insert into public.provider_approvals(provider_id, approved_by, action, reason, created_at)
      values (target_user_id, requester_id, 'revoked', null, now_ts);
  end if;

  return query
    select
      pu.id,
      pu.pi_username,
      pu.user_role,
      pu.provider_approved,
      pu.provider_approved_at,
      pu.provider_approved_by,
      u.provider_status
    from public.users u
    left join public.pi_users pu on pu.id = u.id
    where u.id = target_user_id;
end;
$$;

-- Ensure app can call RPC
grant execute on function public.admin_set_provider_role(uuid, uuid, boolean) to anon, authenticated;
