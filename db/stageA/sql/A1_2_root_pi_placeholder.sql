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
