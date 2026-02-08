# TSBIO Change Log

## 2026-02-07 | v1

* Fix auth trigger
* Sync profile + wallet
* Add DB baseline
* Add baseline system structure



## 2026-02-07 | v2

* Add CONSTITUTION\_TSBIO.md (Full baseline constitution, incl. 2 root admin identities)



## 2026-02-07 | v3

* Phase 0 baseline lock completed in repo: added baseline folders + scripts

  * scripts/db/backup\_db.sh (full pg\_dump)
  * scripts/db/snapshot\_schema.sh (schema-only)
  * scripts/zip\_source\_baseline.sh (export source zip)

* Updated BASELINE.md + Stage0 README with the Phase 0 DoD



## 2026-02-07 | v4

* Phase A (Core + Admin Core)

  * A1: Added root-only guard + Orphan checker (API: /api/admin/orphans)
  * A2: Added wallet + ledger API endpoints (server-only) and rollback tool (admin)
  * A3: Added Admin Core v1 (new routes: /admin/\*) + admin APIs (users/identities/wallets/ledger/audit/rules)
  * DB scripts added under db/stageA/sql:

    * A1\_2\_root\_pi\_placeholder.sql
    * A2\_1\_tsb\_apply\_tx.sql

\## v4 — 2026-02-07 — Phase A Locked



\- A1: Email identity stable, root email locked, Pi pending placeholder

\- A2: Wallet + ledger core verified

\- A3: Admin core baseline

\- Database snapshot full + schema

\- Source snapshot




## v4 — 2026-02-07 — Phase A Locked

- A1: Email identity stable, root email locked, Pi pending
- A2: Wallet + ledger core verified
- A3: Admin core baseline
- Database snapshot: full + schema
- Source snapshot



## 2026-02-07 | v5

* Fix Admin access UX & guard

  * Add "Vào trang quản trị" button on account pages for admin only
  * Block non-admin from viewing /admin content (AdminShell redirects + FORBIDDEN_NOT_ROOT message)


## 2026-02-07 | v6

* Fix Root Admin role bridge (Auth → Profile)

  * /api/auth/ensure-profile now enforces **root email lock**:
    * Email: `dowithpi@gmail.com` → Username: `hlong295`
    * Role: **root_admin** (auto-upgrade if an older profile existed with wrong role)
  * Result: account page can reliably show **"Vào trang quản trị"** for root admin after login (refresh / sign-out-in).


## 2026-02-07 | v9

* Auth core hardening (fix triệt để tình trạng tự logout / dính cookies)
  * Canonical host đổi về **tsbio.life (không www)** để tránh split origin làm mất session (middleware redirect `www.` → root domain).
  * `refreshEmailUserInternal()` luôn tin Supabase session trước (set basic email user ngay) và **không force logout** nếu `/api/auth/me` tạm lỗi.
  * Logout cleanup: clear các localStorage keys của Supabase (`sb-<ref>-*`) để tránh trạng thái kẹt sau redeploy/host alias.

* Kỳ vọng sau patch
  * Đăng nhập xong không bị out ngẫu nhiên.
  * Vào /tai-khoan thấy đúng trạng thái, nút “Vào trang quản trị” vẫn hiện cho root admin.
  * /admin nhận session ổn định (không còn báo “cần đăng nhập email” do lệch domain).


## 2026-02-07 | v10

* Build fix (Vercel prerender)
  * Define missing symbol `refreshEmailUser` in `contexts/auth-context.tsx` (was referenced in context value but not declared)
  * Add stable dependency to context memo to avoid undefined reference during SSR/prerender.


## 2026-02-07 | v11

* Fix fatal redirect loop (ERR_TOO_MANY_REDIRECTS)
  * Remove middleware host canonicalization (www/non-www) because Vercel domain settings may already redirect in the opposite direction, causing an infinite loop.
  * Ops note: pick **one** primary domain in Vercel and keep only one redirect direction. Auth session storage is origin-scoped.


## 2026-02-07 | v12

* Break URL-normalization redirect loops behind proxy
  * Add Next.js experimental flags `skipTrailingSlashRedirect` + `skipMiddlewareUrlNormalize`.
  * Add `/api/health` (no-auth, no-redirect) to quickly confirm the deployment is reachable even if browser hits a redirect loop.


## 2026-02-07 | v23

* Phase B DB migration hotfix (SAFE REPAIR)
  * Add `TSBIO_DB_20260207_v23_phaseB_taxonomy_cms_SAFE.sql` to handle partial/failed v22 runs.
  * Migration is idempotent: creates missing category tables, adds missing columns (`hub_id`, `slug`, etc.), attaches guarded FKs, and extends `products`/`posts`.
  * This matches the chosen long-term taxonomy: **Hub + Product + News + Rescue**.


## 2026-02-07 | v24

* Fix: Admin link bounces to Home after login
  * `/api/auth/me` now returns backward-compatible `{ user: ... }` payload expected by `AuthContext`, while still including `auth/profile/wallet` for debugging.
  * `AdminShell` guard no longer redirects to `/` during role hydration; it allows Root identity (email/username backstop) and shows an in-place error for non-admins.


## 2026-02-07 | v18

* Admin UI layout parity
  * Add `app/admin/layout.tsx` to render the standard site **Header** and **Footer** around all `/admin/*` pages.
  * Adds safe padding so Admin content does not sit under the fixed header / bottom nav.


## 2026-02-07 | v21

* Phase B started: Business + CMS (admin-first)
  * AdminShell now allows roles: root_admin/editor/provider (root tools remain root-only)
  * B1 Product Management UI + APIs
    * Routes: /admin/products, /admin/products/new, /admin/products/[id]
    * Routes: /admin/categories, /admin/providers
    * APIs: /api/admin/products (+ /[id]), /api/admin/categories, /api/admin/providers
    * Soft delete supported via deleted_at (DB migration required)
  * B2 Content CMS UI + APIs (Tin tức / Cứu vườn)
    * Routes: /admin/content/news (+ new/edit), /admin/content/rescue (+ new/edit)
    * APIs: /api/admin/posts (+ /[id])
    * Draft/Publish + SEO fields supported (DB migration required)
  * DB forward migration script added:
    * baselines/database/TSBIO_DB_20260207_v21_phaseB.sql


## 2026-02-07 | v22

* Phase B upgrade: Long-term taxonomy (Hub + Product + News + Rescue)
  * DB migration added: baselines/database/TSBIO_DB_20260207_v22_phaseB_taxonomy_cms.sql
    * New tables: category_hub, product_categories, news_categories, rescue_categories
    * posts.category_id is validated by API (no cross-table FK) to keep domain separation
    * products.category_id FK -> product_categories
  * Admin categories page updated to manage Hub + 3 domain categories (hub_id mapping)
  * Content CMS (Tin tức / Cứu vườn) category dropdowns now read correct domain tables
  * B5 permission: add role "approval" (AdminShell + require-role)
  * Add root-only user role editor page: /admin/users/[id] + API /api/admin/users/[id] (with root protection)
  * B3 Media (minimal): /admin/media + admin APIs to sign-upload & list from Supabase Storage bucket "media"
