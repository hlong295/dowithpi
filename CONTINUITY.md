- Goal (incl. success criteria):
  - Fix PITD purchase (Đổi bằng PITD) end-to-end without touching Pi-payment.
  - Success: POST /api/payments/pitd works (no RLS errors), debits buyer wallet, credits provider + system wallets, writes user_purchases + pitd_transactions.

- Constraints/Assumptions:
  - Do not change UI/strings except minimal error/debug.
  - Do not break Pi login/email login.
  - PITD is internal; all PITD ops must go through server API (no client anon direct writes).

- Key decisions:
  - PITD server routes must use Supabase Service Role key (server-only) via env var SUPABASE_SERVICE_ROLE_KEY.
  - Never fall back to anon for PITD internal operations.

- State:
  - Baseline: fix27 had RLS 'permission denied for table pitd_wallets' due to invalid/fallback admin key.
  - Current patch: fix28 removes hardcoded fallback and requires SUPABASE_SERVICE_ROLE_KEY; returns clear hint if missing.

- Done:
  - Patched lib/supabase/admin.ts to require SUPABASE_SERVICE_ROLE_KEY (no fake fallback).
  - Patched app/api/payments/pitd/route.ts to return clear error & hint when env missing.

- Now:
  - User must set SUPABASE_SERVICE_ROLE_KEY on hosting (Vercel) and redeploy, then retest PITD purchase.

- Next:
  - If still failing after env set, inspect returned JSON/debug and patch only PITD purchase route.

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Whether deployment environment supports setting server env vars for Pi App Studio runtime.

- Working set (files/ids/commands):
  - lib/supabase/admin.ts
  - app/api/payments/pitd/route.ts
