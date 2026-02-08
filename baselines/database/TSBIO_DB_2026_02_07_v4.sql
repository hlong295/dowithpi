-- TSBIO DATABASE BASELINE (v3)
-- Date: 2026-02-07
-- Auto-collected from Supabase exports

-- Phase 0 companion scripts (run manually after snapshot):
-- - db/stage0/sql/0_2_lock_root_admin.sql
-- - db/stage0/sql/0_3_namespace_username.sql
-- Backup + schema snapshot scripts:
-- - scripts/db/backup_db.sh
-- - scripts/db/snapshot_schema.sh



-- =====================================
-- ✅ BƯỚC 1 — DANH SÁCH TOÀN BỘ BẢNG.txt
-- =====================================

table_schema,table_name
public,audit_logs
public,farms
public,identities
public,kyc_records
public,orders
public,products
public,profiles
public,reputation_logs
public,system_rules
public,tsb_transactions
public,tsb_wallets


-- =====================================
-- ✅ BƯỚC 2 — CẤU TRÚC CHI TIẾT TỪNG BẢNG-identities.txt
-- =====================================

column_name,data_type,is_nullable,column_default
id,uuid,NO,gen_random_uuid()
provider_id,text,NO,null
profile_id,uuid,YES,null
user_id,uuid,NO,null
identity_data,jsonb,NO,null
provider,text,YES,null
provider,text,NO,null
provider_uid,text,YES,null
created_at,timestamp with time zone,YES,now()
last_sign_in_at,timestamp with time zone,YES,null
created_at,timestamp with time zone,YES,null
updated_at,timestamp with time zone,YES,null
email,text,YES,null
id,uuid,NO,gen_random_uuid()


-- =====================================
-- ✅ BƯỚC 2 — CẤU TRÚC CHI TIẾT TỪNG BẢNG-profiles.txt
-- =====================================

column_name,data_type,is_nullable,column_default
id,uuid,NO,null
username,text,YES,null
full_name,text,YES,null
avatar_url,text,YES,null
dob,date,YES,null
gender,text,YES,null
phone,text,YES,null
phone_verified,boolean,YES,false
email,text,YES,null
email_verified,boolean,YES,false
address,text,YES,null
role,text,YES,'member'::text
level,text,YES,'basic'::text
created_at,timestamp with time zone,YES,now()
updated_at,timestamp with time zone,YES,now()


-- =====================================
-- ✅ BƯỚC 2 — CẤU TRÚC CHI TIẾT TỪNG BẢNG-tsb_tsb_transactions.txt
-- =====================================

column_name,data_type,is_nullable,column_default
id,uuid,NO,gen_random_uuid()
wallet_id,uuid,YES,null
type,text,YES,null
amount,numeric,YES,null
balance_after,numeric,YES,null
reference_type,text,YES,null
reference_id,uuid,YES,null
metadata,jsonb,YES,null
created_at,timestamp with time zone,YES,now()


-- =====================================
-- ✅ BƯỚC 2 — CẤU TRÚC CHI TIẾT TỪNG BẢNG-tsb_wallets.txt
-- =====================================

column_name,data_type,is_nullable,column_default
id,uuid,NO,gen_random_uuid()
profile_id,uuid,YES,null
balance,numeric,YES,0
locked,numeric,YES,0
created_at,timestamp with time zone,YES,now()


-- =====================================
-- ✅ BƯỚC 3 — FOREIGN KEY + RELATION.txt
-- =====================================

table_name,column_name,foreign_table,foreign_column
audit_logs,actor_id,profiles,id
reputation_logs,profile_id,profiles,id
orders,buyer_id,profiles,id
products,farm_id,farms,id
products,seller_id,profiles,id
farms,owner_id,profiles,id
tsb_transactions,wallet_id,tsb_wallets,id
tsb_wallets,profile_id,profiles,id
kyc_records,profile_id,profiles,id
identities,profile_id,profiles,id


-- =====================================
-- ✅ BƯỚC 4 — INDEX.txt
-- =====================================

tablename,indexname,indexdef
audit_logs,audit_logs_pkey,CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)
farms,farms_pkey,CREATE UNIQUE INDEX farms_pkey ON public.farms USING btree (id)
identities,identities_pkey,CREATE UNIQUE INDEX identities_pkey ON public.identities USING btree (id)
identities,identities_provider_provider_uid_key,"CREATE UNIQUE INDEX identities_provider_provider_uid_key ON public.identities USING btree (provider, provider_uid)"
kyc_records,kyc_records_pkey,CREATE UNIQUE INDEX kyc_records_pkey ON public.kyc_records USING btree (id)
orders,orders_pkey,CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)
products,products_pkey,CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)
profiles,profiles_username_lower_uniq,CREATE UNIQUE INDEX profiles_username_lower_uniq ON public.profiles USING btree (lower(username)) WHERE (username IS NOT NULL)
profiles,profiles_pkey,CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)
profiles,profiles_username_key,CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username)
reputation_logs,reputation_logs_pkey,CREATE UNIQUE INDEX reputation_logs_pkey ON public.reputation_logs USING btree (id)
system_rules,system_rules_pkey,CREATE UNIQUE INDEX system_rules_pkey ON public.system_rules USING btree (key)
tsb_transactions,tsb_transactions_pkey,CREATE UNIQUE INDEX tsb_transactions_pkey ON public.tsb_transactions USING btree (id)
tsb_wallets,tsb_wallets_pkey,CREATE UNIQUE INDEX tsb_wallets_pkey ON public.tsb_wallets USING btree (id)
tsb_wallets,tsb_wallets_profile_id_key,CREATE UNIQUE INDEX tsb_wallets_profile_id_key ON public.tsb_wallets USING btree (profile_id)


-- =====================================
-- ✅ BƯỚC 5 — TRIGGER.txt
-- =====================================

event_object_table,trigger_name,action_timing,event_manipulation,action_statement
users,on_auth_user_created,AFTER,INSERT,EXECUTE FUNCTION handle_new_auth_user()


-- =====================================
-- ✅ BƯỚC 6 — FUNCTION (PLpgSQL).txt
-- =====================================

proname,pg_get_functiondef
email,"CREATE OR REPLACE FUNCTION auth.email()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$function$
"
handle_new_auth_user,"CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN

  -- 1. Tạo profile (dùng luôn auth id)
  INSERT INTO public.profiles (
    id,
    email,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Tạo wallet (gắn với profile_id)
  INSERT INTO public.tsb_wallets (
    profile_id,
    balance,
    locked,
    created_at
  )
  VALUES (
    NEW.id,
    0,
    0,
    now()
  )
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;

END;
$function$
"
handle_new_user,"CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin

  insert into profiles(id, email, email_verified)
  values (new.id, new.email, true)
  on conflict do nothing;

  insert into tsb_wallets(profile_id)
  values (new.id)
  on conflict do nothing;

  return new;

end;
$function$
"
jwt,"CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$
"
role,"CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$
"
uid,"CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$
"


-- =====================================
-- ✅ BƯỚC 7 — RLS POLICY (BẢO MẬT).txt
-- =====================================

schemaname,tablename,policyname,permissive,roles,cmd,qual
public,orders,orders_read_own,PERMISSIVE,{public},SELECT,(buyer_id = auth.uid())
public,products,products_public_read,PERMISSIVE,{public},SELECT,(active = true)
public,profiles,profile_update_own,PERMISSIVE,{public},UPDATE,(auth.uid() = id)
public,profiles,profile_read_own,PERMISSIVE,{public},SELECT,(auth.uid() = id)
public,tsb_wallets,wallet_read_own,PERMISSIVE,{public},SELECT,(profile_id = auth.uid())


-- =====================================
-- ✅ BƯỚC 8 — CHECK USER  WALLET  IDENTITY HIỆN CÓ.txt
-- =====================================

id,username,email,role,provider,balance
810e655d-eedb-4788-b13d-fd0bba1dc0a7,null,test_ok@tsbio.life,member,null,0
-- A1.2 — Root Pi Placeholder (DB-side)
-- Create a placeholder identity for Pi root username (pi_hlong295) mapped to the SAME profile_id as root email.
-- This does NOT require Pi SDK and does NOT create auth.users entries.

BEGIN;

DO $$
DECLARE
  v_root_id uuid;
BEGIN
  SELECT id INTO v_root_id FROM public.profiles WHERE lower(username) = 'hlong295' LIMIT 1;
  IF v_root_id IS NULL THEN
    RAISE EXCEPTION 'A1.2: root email profile (hlong295) not found. Run P0.2 first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.identities
    WHERE profile_id = v_root_id
      AND provider = 'pi'
      AND lower(provider_uid) = 'pi_hlong295'
  ) THEN
    INSERT INTO public.identities(profile_id, provider, provider_uid, identity_data, created_at)
    VALUES (
      v_root_id,
      'pi',
      'pi_hlong295',
      jsonb_build_object('status','pending','note','Pi root placeholder; activate after Pi SDK'),
      now()
    );
  END IF;
END $$;

COMMIT;
-- A2.1 — Balance engine + Ledger core (DB-side)
-- Atomic: updates tsb_wallets and inserts tsb_transactions.
-- Required for server API balance engine and rollback tool.

BEGIN;

-- Ensure wallet uniqueness: tsb_wallets(profile_id) unique already.

CREATE OR REPLACE FUNCTION public.tsb_apply_tx(
  p_profile_id uuid,
  p_amount numeric,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_tx_id uuid;
BEGIN
  -- Ensure wallet exists
  INSERT INTO public.tsb_wallets(profile_id, balance, locked)
  VALUES (p_profile_id, 0, 0)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Lock wallet row
  SELECT id, balance
  INTO v_wallet_id, v_balance
  FROM public.tsb_wallets
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_new_balance := coalesce(v_balance, 0) + coalesce(p_amount, 0);
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.tsb_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.tsb_transactions(
    wallet_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    metadata,
    created_at
  )
  VALUES (
    v_wallet_id,
    p_type,
    p_amount,
    v_new_balance,
    p_reference_type,
    p_reference_id,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'wallet_id', v_wallet_id,
    'balance', v_new_balance,
    'tx_id', v_tx_id
  );
END;
$$;

COMMIT;
