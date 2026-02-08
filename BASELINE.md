# TSBIO Baseline

Current Source: TSBIO_SRC_20260208_v27_A1.zip
Current DB: TSBIO_DB_2026_02_07_v4.sql (+ Phase B taxonomy/cms migration v23B SAFE)

Last update: 2026-02-08

## Phase A — HOME (Mockup) progress
- A1 (Hero + CTA + Search) implemented in source v27_A1. DB script added: `db/stageA/sql/A1_1_CREATE_APP_SETTINGS.sql`.

## Baseline folders (required)
- /baselines/source
- /baselines/database
- /baselines/logs

## Phase 0 — Baseline Lock (DoD)
1) DB backup created (pg_dump) → /baselines/database/
2) Schema snapshot created → /baselines/database/
3) Root admin (2 identities) locked (email locked + pi placeholder pending) → db/stage0/sql/
4) Namespace username locked (lowercase + unique + block pi_ prefix) → db/stage0/sql/
5) Source zip exported → /baselines/source/

## Phase A — Core + Admin Core (DoD)
### A1 — Auth + Identity
- Email auth remains stable (no UI changes)
- Profile sync via /api/auth/ensure-profile
- Identity link email maintained
- Root guard enforced server-side for admin APIs
- Root pi placeholder SQL provided (db/stageA/sql/A1_2_root_pi_placeholder.sql)
- Orphan checker API: /api/admin/orphans

### A2 — Wallet + Ledger
- User wallet API: /api/tsb/wallet
- User ledger API: /api/tsb/ledger
- Balance engine DB function provided: db/stageA/sql/A2_1_tsb_apply_tx.sql
- Rollback tool (admin): /api/admin/ledger/rollback

### A3 — Admin Core v1
- Admin pages: /admin, /admin/users, /admin/identities, /admin/wallets, /admin/ledger, /admin/audit, /admin/rules, /admin/orphans
- Admin APIs: /api/admin/users, /api/admin/identities, /api/admin/wallets, /api/admin/ledger, /api/admin/audit, /api/admin/rules

## Current Baseline — v23 (2026-02-07)

- Phase: A in progress (Auth core hardening done; remaining A1/A2 edgecases to validate)
- DB: TSBIO_DB_20260207_v4_full.dump
- Schema: TSBIO_DB_20260207_v4_schema.sql
- Source: TSBIO_SRC_20260207_v23.zip
- Root: hlong295 (email), pi_hlong295 (pending)


### A3.x — Admin Access Guard
- Account pages show "Vào trang quản trị" button only for admin (role = root_admin/admin).
- /admin UI blocks non-admin and redirects away (AdminShell guard).

## Phase B — Business + CMS (STARTED)

### B1 — Product Management (Admin View)
- New admin routes: /admin/products, /admin/categories, /admin/providers
- New admin APIs: /api/admin/products, /api/admin/categories, /api/admin/providers
- Soft delete supported via products.deleted_at (requires DB migration v23 SAFE script)

### B2 — Content CMS (Admin View)
- Tin tức CMS: /admin/content/news (+ new/edit)
- Cứu vườn CMS: /admin/content/rescue (+ new/edit)
- Admin APIs: /api/admin/posts and /api/admin/posts/[id]
- Draft/Publish + SEO fields supported (requires DB migration v23 SAFE script)

### B1/B2 — Long-term taxonomy (Hub + Product + News + Rescue)
- Categories are split by domain tables and linked via optional category_hub.
- DB migration (safe repair): baselines/database/TSBIO_DB_20260207_v23_phaseB_taxonomy_cms_SAFE.sql

### B3 — Media (Admin View, minimal)
- /admin/media (signed upload + list) uses Supabase Storage bucket "media".

### A3.x — Admin Layout Parity
- Added `app/admin/layout.tsx` so all `/admin/*` pages render the standard site Header + Footer.
- Added spacing to avoid overlap with the fixed header and bottom nav.

### A1.x — Auth Core Hardening
- Domain: **Do not** enforce www/non-www in middleware. Pick **one** primary domain in Vercel (recommended: keep `www.tsbio.life` as Primary) and set a single redirect there.
- Next.js: disable URL-normalisation redirects that can loop behind proxies (see next.config.mjs).
- Auth bridge failure no longer forces logout; session remains source of truth.
- Logout now clears Supabase persisted session keys to avoid "sticky" state.

### Ops — Health endpoint
- /api/health returns { ok: true } to help verify the domain is serving without any auth/redirect.

### A1.x — Root Email Lock (Auth → Profile)
- /api/auth/ensure-profile enforces root email lock:
  - Email: dowithpi@gmail.com
  - Username: hlong295
  - Role: root_admin (auto-upgrade if older profile existed)
