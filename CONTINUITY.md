- Goal (incl. success criteria):
  - Implement **Quay số trúng thưởng (Lucky Spin)** at **/lucky-spin** with UI matching provided mockup.
  - Add DB tables: **spin_rewards, spin_logs, spin_daily_limits** (Supabase/Postgres).
  - Anti-abuse: server-side **rate limit**, **anti-refresh spam** (daily limit), **idempotency key**.
  - Admin-configurable rewards & weights **inside the /lucky-spin page** (visible only to root admin/admin via server verification).
  - User history on /lucky-spin.
  - Pi payout: if reward is **Pi** then mark as **pending_contact**; user sees a “Nhận thưởng” section to review/submit contact info; admin pays out manually.
  - Constraints: **do not break existing UI elsewhere**, **do not touch Pi/email login flows**, **PITD remains server-only** (all PITD balance changes must go through API routes).

- Constraints/Assumptions:
  - Pi Browser has no console: allow optional on-screen debug (query `?dbg=1`).
  - Use existing server-side Supabase admin client (`lib/supabase/admin.ts`) for all writes.
  - Use existing auth resolver for APIs (`getAuthenticatedUserId`, `requireAdmin`).

- Key decisions:
  - Lucky Spin is implemented via **server APIs** under `/api/lucky-spin/*`.
  - PITD reward crediting uses the existing PITD ledger helper (`lib/pitd/ledger.ts`) to update wallet balance + insert `pitd_transactions`.
  - Store global max spins/day in `spin_daily_limits` as a special **global row** (user_id NULL, limit_date NULL).

- State:
  - Baseline input source: `dowithpi_buy_sell_pi_patch_20260114_PINETFIX18_HOMEFIX_JSONVAR.zip`.
  - Current work: add Lucky Spin DB SQL + APIs + UI.

- Done:
  - Buy/Sell Pi page + APIs + Home block fetching live rates (from prior work) – kept as baseline.

- Now:
  - Add Lucky Spin SQL (tables + indexes + minimal RLS stance).
  - Implement Lucky Spin APIs: config, spin, history, claim.
  - Implement /lucky-spin UI per mockup with admin config area.

- Next:
  - User runs SQL on Supabase.
  - User deploys updated ZIP and tests on Pi Browser; if needed, refine reward wheel rendering and debug.

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/lucky-spin/page.tsx
  - app/lucky-spin/ui/*
  - app/api/lucky-spin/config/route.ts
  - app/api/lucky-spin/spin/route.ts
  - app/api/lucky-spin/history/route.ts
  - app/api/lucky-spin/claim/route.ts
  - lib/lucky-spin/*
  - SQL_LUCKY_SPIN_TABLES.sql
