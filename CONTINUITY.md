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

- Update (fix31):
  - Added explicit detection for **permission denied** on `pitd_wallets` even when using service role.
  - When detected, API returns message `PITD_DB_PERMISSION_DENIED` and includes an SQL hint to **GRANT** privileges back to `service_role`.
  - Reason: the error indicates DB privileges were REVOKE/GRANT-ed in a way that blocks even service role; code alone can't bypass that.

- Update (fix36):
  - Added optional RPC fallback for PITD purchase: `public.pitd_purchase(...)` (SECURITY DEFINER) to bypass broken GRANT/REVOKE states on `pitd_wallets`.
  - SQL to create the function is provided at `sql/pitd_purchase_rpc.sql` and must be run once (role: postgres).
  - app/api/payments/pitd now tries `rpc('pitd_purchase', ...)` and returns clear SQL hint if function is missing.

- Update (fix41):
  - Fix PI user purchases not showing: **server no longer trusts client `userId`** for PITD purchases.
  - app/api/payments/pitd now derives `requesterId` from cookies (getAuthenticatedUserId) and uses that to resolve master user + record `user_purchases`.
  - Added debug fields `requesterId` and `clientUserId` in API debug payload to verify mismatches on Pi Browser.
  - Fix PI payment purchase recording: app/api/payments/complete now writes `user_purchases.user_id = purchaseUserId` (resolved master) instead of client-sent userId.

- Update (fix42):
  - Root cause (Pi Browser): một số fetch không tự gửi cookie => server không lấy được requesterId => lỗi "Không tìm thấy tài khoản" hoặc không load được purchases.
  - Fix: client fetch thêm `credentials: 'include'` và gửi header `x-pi-user-id` (khi user.type === 'pi'):
    - components/exchange-modal.tsx (POST /api/payments/pitd)
    - app/account/page.tsx (GET /api/purchases)

- Update (fix44):
  - Symptom: Pi user (hlong295) PITD purchase succeeds but Account → "Sản phẩm đã mua" shows empty.
  - Root cause: Account page may send stale `x-pi-user-id` from localStorage, while server records purchases under a different master users.id; /api/purchases then queries the wrong user_id.
  - Fix:
    - app/account/page.tsx: derive currentUserId from cookie (`pitodo_pi_user` / `pi_user_id`) first (JSON-aware), then fallback to localStorage.
    - app/api/purchases: when resolving master id, enrich from pi_users (id→pi_uid/pi_username) so `resolveMasterUserId` can resolve consistently.

- Update (fix45):
  - Symptom: Pi user purchase (Pi & PITD) can succeed but purchases list still empty if the API sometimes identifies the user via a different source (Bearer token vs Pi header/cookie).
  - Fix: `lib/pitd/require-user.ts` now **prefers `x-pi-user-id`** (Pi Browser explicit identity) over Bearer token, then Pi cookie, then Bearer.
  - Goal: ensure purchase recording and purchases listing use the same user id for Pi users across environments.

- Update (fix46):
  - Symptom (still): Pi user PITD purchase shows success popup but Account → "Sản phẩm đã mua" remains empty.
  - Root cause: server sometimes records purchases under one identity source (Bearer/supabase auth uid) while listing uses another (Pi cookie/header) → `user_purchases.user_id` mismatch.
  - Fix: all relevant server routes now resolve **master user by Pi identity first** when available:
    - app/api/payments/pitd: pass `piUserId/piUsername` from request to `resolveMasterUserId` (and treat non-uuid `piUserId` as `pi_uid`).
    - app/api/purchases: same enrichment before querying `user_purchases`.
    - app/api/payments/complete (Pi payment): also resolves master with Pi identity (and fixes missing req param on `getAuthenticatedUserId`).

- Update (fix47):
  - Vercel build failed: `Can't resolve '@/lib/pitd/pi-identity'`.
  - Fix: add missing helper `lib/pitd/pi-identity.ts` exporting `getPiIdentityFromRequest(req)` used by:
    - app/api/payments/complete/route.ts
    - app/api/purchases/route.ts
  - Helper reads Pi identity from headers/cookies (pi_user_id, pitodo_pi_user) and falls back to `extractUserIdFromRequest`.

- Update (fix48):
  - Pi Browser PITD payment failed with UI debug: `getPiIdentityFromRequest is not defined`.
  - Root cause: app/api/payments/pitd/route.ts referenced `getPiIdentityFromRequest(...)` but forgot to import it.
  - Fix: add `import { getPiIdentityFromRequest } from "@/lib/pitd/pi-identity";` to app/api/payments/pitd/route.ts.
