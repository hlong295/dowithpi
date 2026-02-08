-- P0.3 — Lock Namespace Username (DB-side)
-- Enforce: profiles.username is lowercase + case-insensitive unique
-- Rule: Email usernames MUST NOT start with 'pi_' (reserved for Pi namespace)

-- Step 1) Normalize usernames to lowercase
BEGIN;
UPDATE public.profiles
SET username = lower(username), updated_at = now()
WHERE username IS NOT NULL;
COMMIT;

-- Step 2) Check duplicates BEFORE creating unique index
-- Expect: no rows returned
SELECT lower(username) AS uname, count(*)
FROM public.profiles
WHERE username IS NOT NULL
GROUP BY lower(username)
HAVING count(*) > 1;

-- Step 3) Create unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq
ON public.profiles ((lower(username)))
WHERE username IS NOT NULL;

-- Step 4) Constraint: block 'pi_' prefix in profiles.username (email namespace)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_not_pi_prefix;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_not_pi_prefix
CHECK (
  username IS NULL
  OR lower(username) NOT LIKE 'pi\_%'
);
