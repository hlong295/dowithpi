-- P0.2 — Lock Root Admin (DB-side)
-- Root Admin (email): username 'hlong295', email 'dowithpi@gmail.com'
-- Root Admin (pi): username 'pi_hlong295' (Pi UUID pending, do not create fake UID)
--
-- NOTE:
-- - This script does NOT create auth.users rows.
-- - Run this ONLY after the email user is created through Auth UI or Supabase Auth Dashboard.

BEGIN;

-- 1) Ensure profile exists for username 'hlong295'
-- If missing, stop here and create the auth user first.
DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(username) = 'hlong295'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'P0.2: profile for username hlong295 not found. Create auth user (dowithpi@gmail.com) first.';
  END IF;

  -- 2) Set role to root_admin
  UPDATE public.profiles
  SET role = 'root_admin', updated_at = now()
  WHERE id = v_profile_id;

  -- 3) Ensure identities mapping for email exists
  IF NOT EXISTS (
    SELECT 1 FROM public.identities
    WHERE profile_id = v_profile_id
      AND provider = 'email'
      AND lower(provider_uid) = 'dowithpi@gmail.com'
  ) THEN
    INSERT INTO public.identities (profile_id, provider, provider_uid, created_at)
    VALUES (v_profile_id, 'email', 'dowithpi@gmail.com', now());
  END IF;
END $$;

COMMIT;
