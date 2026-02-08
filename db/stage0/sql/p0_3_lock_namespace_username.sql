-- P0.3 — Lock Namespace Username (DB-side)
-- Strategy: normalize -> check duplicates -> unique index -> constraint.

-- STEP 1: Normalize all usernames to lowercase
BEGIN;
UPDATE public.profiles
SET username = lower(username),
    updated_at = now()
WHERE username IS NOT NULL;
COMMIT;

-- STEP 2: Check duplicates (must return 0 rows)
-- If returns rows, resolve before creating the unique index.
SELECT lower(username) AS uname, count(*)
FROM public.profiles
WHERE username IS NOT NULL
GROUP BY lower(username)
HAVING count(*) > 1;

-- STEP 3: Create unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq
ON public.profiles ((lower(username)))
WHERE username IS NOT NULL;

-- STEP 4: Block email namespace from using reserved Pi prefix "pi_"
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_not_pi_prefix;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_not_pi_prefix
CHECK (
  username IS NULL
  OR lower(username) NOT LIKE 'pi\_%'
);
