# Continuity Ledger (TSBIO)

## Goal (incl. success criteria):
- Follow checklist 1.checklisttrienkhaiv3.docx.
- Implement **Phase B — Business + CMS** (admin-first) without breaking UI/auth:
  - B1 Product management (Farm/TSBIO products, category, stock, provider, soft delete)
  - B2 Content CMS (Tin tức + Cứu vườn, draft/publish, SEO, category)
  - B3 Media system (signed upload, list; bucket `media`)
  - B4 Business audit (product/post logs; restore)
  - B5 Permissions (root full, editor/provider/approval)
  - Output new baselines: Source zip + DB migration snapshot + changelog.

## Constraints/Assumptions:
- Do not change approved UI/layout/UX flows.
- Do not break Pi login; Pi login remains beta/pending SDK.
- Token/wallet/ledger operations must go through server APIs.
- Username namespace:
  - Email username: hlong295
  - Pi username: pi_hlong295
  - Case-insensitive (normalized lowercase).

## Key decisions:
- Use Supabase Auth for Email flow.
- Add server APIs using service role for provisioning profiles/identities/tsb_wallets.
- Client Supabase (anon) is used only for auth (signUp/signIn/reset/update password).

## State:
- Current baseline source: **TSBIO_SRC_20260207_v24.zip**
- Phase B taxonomy choice: **Hub + Product + News + Rescue** (4 tables)
- DB migration applied by user: **V23B SAFE (NO EXCEPTION)** (created/altered taxonomy tables + posts + triggers)
- Hotfix pending verification: Admin page access should no longer bounce to Home after login.

## Done:
- v5: Admin access button (account) + /admin guard (AdminShell) implemented.
- Baseline folder structure exists: /baselines/source, /baselines/database, /baselines/logs
- Added scripts for Phase 0 baseline lock:
  - scripts/db/backup_db.sh
  - scripts/db/snapshot_schema.sh
  - scripts/zip_source_baseline.sh
- Updated BASELINE.md + Stage0 README + changelog
- Added /dang-ky, /quen-mat-khau, /cap-nhat-mat-khau pages (fix 404 on /dang-ky).
- Added API routes:
  - /api/auth/resolve-email (username -> email)
  - /api/auth/ensure-profile (post-login provisioning)
  - /api/auth/me (profile+wallet)
  - /api/auth/provision-signup (avoid orphans when email verification enabled)
- Updated auth-context to support EmailUser in parallel with PiUser.
- Updated tai-khoan dashboard to work with email user and show TSB wallet.

## Update (2026-02-06):
- Fix header overlap on auth pages by offsetting main content (AppHeader is fixed h-14).
- Remove specific example placeholders (hlong295/dowithpi@gmail.com) from register UI, use generic examples.
- Fix "No API key found in request" during email signup by providing runtime-injected public Supabase config:
  - app/layout.tsx injects window.__TSBIO_PUBLIC_ENV__ (Supabase URL + ANON key) beforeInteractive.
  - lib/supabase/client.ts falls back to window.__TSBIO_PUBLIC_ENV__ when NEXT_PUBLIC_* are not inlined.

## Done:
- v5: Admin access button (account) + /admin guard (AdminShell) implemented.
- Phase A code changes added (Admin Core v1 + server APIs + db/stageA SQL).
- Updated changelog, BASELINE.md, and created DB snapshot file TSBIO_DB_2026_02_07_v4.sql (v3 + stageA SQL scripts).

## Now:
- Fix root admin role bridge so account page can show Admin button reliably.

## Next:
- Re-login root email (or Sign out → Sign in) to let /api/auth/ensure-profile auto-upgrade role to root_admin.
- Verify /tai-khoan shows "Vào trang quản trị" and /admin blocks non-admin.

## Open questions (UNCONFIRMED if needed):
- Root admin email account does not exist in auth.users yet on your DB (confirmed by your query).
- Whether Supabase email confirmation is enabled and redirect URL configured.

## Working set (files/ids/commands):
- Source: TSBIO_BASELINED_SRC_2026_02_07_v2.zip
- Output: TSBIO_SRC_2026_02_07_v4.zip (repo baselines/source)
- Docs: db/stage0/docs/README_STAGE0.md
- DB scripts: db/stageA/sql/A1_2_root_pi_placeholder.sql, db/stageA/sql/A2_1_tsb_apply_tx.sql
- Scripts: scripts/db/backup_db.sh, scripts/db/snapshot_schema.sh, scripts/zip_source_baseline.sh
## Update — Phase A Locked (2026-02-07)

Done:
- Phase A DB snapshot (full + schema)
- Wallet & ledger core verified
- Identity baseline locked

Now:
- Preparing Phase B

Next:
- Implement Phase B modules

## Update — v6 (2026-02-07)

Done:
- Root email lock enforced in /api/auth/ensure-profile (dowithpi@gmail.com → hlong295, role root_admin).

Now:
- Build and publish source zip v6.


## Update — v9 (2026-02-07)

Done:
- Auth core hardening to stop random logout / stuck state:
- Domain canonicalization **must not** be enforced in middleware (can create redirect loops depending on Vercel primary domain). Choose **one** primary domain in Vercel and set redirect there.
  - auth-context now always derives a basic EmailUser from Supabase session first (never force logout if /api/auth/me fails transiently).
  - logout clears supabase-js localStorage keys to avoid sticky auth.

Now:
- Validate A1 "Email auth stable" on production (no auto-logout, /admin recognizes session, no need to clear cookies).

Next:
- Continue Phase A checklist: A1 profile sync + identity link verifications, then A2 wallet/ledger rollback tool, then A3 admin pages completeness.

## Update — v10 (2026-02-07)

Done:
- Fix Vercel build/prerender crash: missing symbol `refreshEmailUser` in `contexts/auth-context.tsx`.

Now:

## Update — Phase A / A1 (2026-02-08)

Done:
- A1.1: Added `app_settings` table SQL (StageA) and public API `/api/public/app-settings` (safe fallback to defaults if DB/env not ready).
- A1.2: Home hero CTA button “HỖ TRỢ KỸ THUẬT CHUYÊN SÂU” links to `/cuu-vuon`.
- A1.3: Added hero search box on Home: enter keyword → routes to `/chan-doan?q=...` (prefill). Added minimal `/chan-doan` route to avoid 404.

Now:
- User to apply SQL script in Supabase when ready; UI uses defaults meanwhile.

Next:
- Continue Phase A: A2 “Gói cứu vườn nổi bật” data binding.
- Re-deploy with v10 and confirm build passes.

Next:
- Resume Phase A checklist items (A1 → A2 → A3).

## Update — v18 (2026-02-07)

Done:
- Added `app/admin/layout.tsx` to render standard AppHeader + AppFooter on all `/admin/*` pages.
- Added safe spacing so admin content is not covered by fixed header/bottom nav.

Now:
- Rebuild and deploy v18; validate mobile + desktop UI on /admin.

Next:
- Continue Phase A (Auth+Identity → Wallet+Ledger → Admin Core v1).

## Update — v12 (2026-02-07)

Done:
- Add Next.js config flags to skip URL-normalisation redirects that can cause persistent `ERR_TOO_MANY_REDIRECTS` behind Vercel/proxy.
- Add `/api/health` (no auth, no redirect) for quick diagnosis.

Now:
- Deploy v12 and verify you can open both `https://tsbio.life` and `https://www.tsbio.life` without redirect loop.

Next:
- If loop persists, the redirect is coming from Vercel Domain settings (primary domain redirect). Fix by setting **one** primary domain and **one** redirect direction (or disable primary redirect) then re-test.

## Update — v22 (2026-02-07)

Goal:
- Continue Phase B (Business + CMS) with long-term taxonomy (Hub + Product + News + Rescue), without breaking UI/auth.

Done:
- DB forward migration script added (apply on Supabase): baselines/database/TSBIO_DB_20260207_v22_phaseB_taxonomy_cms.sql
  - New tables: category_hub, product_categories, news_categories, rescue_categories
  - products.category_id now FK -> product_categories
  - posts.category_id stays uuid; API validates by type (news/rescue) against correct table
  - Added soft delete (deleted_at) + updated_at triggers on key tables
- Admin categories page upgraded: manage Hub + 3 domain category tables and map hub_id
- Content CMS (Tin tức/Cứu vườn) category dropdowns now load correct domain tables
- B5 permission extended: add role "approval" (AdminShell + require-role)
- Root-only user role editor: /admin/users/[id] + API /api/admin/users/[id]
- B3 media (minimal): /admin/media + APIs sign-upload/list for storage bucket "media"

Now:
- User applies DB migration v22 (taxonomy/cms) and verifies admin pages work.

Next:
- Phase B tiếp: B4 audit restore view (filter by action/type), approval workflow for provider/editor actions (UNCONFIRMED).

Open questions (UNCONFIRMED):
- Supabase Storage: bucket "media" already exists? If not, create in Supabase dashboard or via SQL.
- Approval workflow rules for role "approval" (what can approve: posts/products/providers?)
