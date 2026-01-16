- Goal (incl. success criteria):
  - Fix Lottery admin "Lưu cấu hình" on /lucky-spin so root admin (pi user hlong295) can save config/prizes without "ADMIN_SAVE_FAILED".
    Current blocker: `null value in column \"open_at\" of relation \"lottery_events\" violates not-null constraint`.
  - Must not break Pi login/email login flows or UI.
  - Hoàn thiện trang **Mua - Bán Pi** (/buy-sell-pi): hiển thị **giá mua/giá bán Pi (VND)** + **thời gian cập nhật** theo UI hiện có, tối ưu mobile.
  - Admin (server-verified) có thể cập nhật trực tiếp giá mua/giá bán ngay trên trang; người dùng thường chỉ xem.
  - Không phá UI phần khác; không làm hư login Pi user + email/user; PITD vẫn server-only qua API route.

- Constraints/Assumptions:
  - Pi Browser may drop cookies/headers unpredictably; allow root admin auth via pi_username signals.
  - PITD remains server-only; Lottery admin uses Supabase service role on server.
  - Chỉ làm đúng phạm vi Mua - Bán Pi; không chỉnh các trang/blocks khác.
  - Pi Browser không có console log ⇒ có thể hiển thị debug nhỏ (non-invasive) trong khối admin.
  - Lưu giá vào DB (app_settings). Nếu DB chưa có cột, cần chạy SQL bổ sung.

- Key decisions:
  - Accept "service role" for lottery admin API (server-only).
  - Robust root admin detection: accept x-user-id containing pi_username, x-pi-username header, or ?pi_username= query param.
  - Lưu giá mua/giá bán Pi ở **public.app_settings** (cột: pi_buy_price_vnd, pi_sell_price_vnd) để tránh tạo bảng mới.
  - Public đọc qua GET /api/pi-exchange/rates; admin cập nhật qua POST /api/admin/pi-exchange/rates (server-side requireAdmin).

- State:
  - Current working patch: buildfix24 (local).
  - Baseline (input): dowithpi_perf_patch_20260113.zip.
  - Current patch: Lottery open_at NOT NULL hardening + Buy/Sell Pi rates page + APIs.

- Done:
  - Updated lottery auth header parsing to infer pi_username from x-user-id when present.
  - Updated lottery admin config API to treat x-pi-username as forced root (same as query param).
  - Added server debug fields on FORBIDDEN to aid Pi Browser screenshot debugging.
  - Implemented Buy/Sell Pi rates UI (shows buy/sell VND + updated time; admin-only editor section).
  - Pi App Studio compatibility: render /buy-sell-pi **client-only (ssr:false)**; make page.tsx a **Client Component ("use client")** to satisfy Next.js build constraints to avoid "Application error: a client-side exception"; added an error boundary that shows a small on-screen debug message only if the page crashes.
  - Added public API: GET /api/pi-exchange/rates.
  - Added admin API: POST /api/admin/pi-exchange/rates (requires admin; updates app_settings).
  - Added SQL helper: SQL_BUY_SELL_PI_PRICES.sql (adds pi_buy_price_vnd, pi_sell_price_vnd).
  - Build fix: rewrote PageErrorBoundary type generics into named Props/State types to avoid TSX parser ambiguity on Vercel.

  - Fix: BuySellPiClient fetch URLs for editors + user-search (previously corrupted => list empty).
  - Add: API rates returns updated_by_label; UI shows "Cập nhật bởi: <pi_username/email>".
  - Add SQL: app_settings.pi_exchange_updated_by (uuid) to persist last editor.

  - Lottery admin save hardening (open_at NOT NULL fix):
    - API /api/lottery/admin/config reads payload `{ event, prizes }` correctly.
    - Date parsing accepts datetime-local (`YYYY-MM-DDTHH:MM`) and common localized formats (`MM/DD/YYYY HH:MM` or `DD/MM/YYYY HH:MM`).
    - If open/close/draw is missing OR present-but-unparseable, return 400 with on-screen debug (no DB insert attempt).
    - Client-side datetime parsing: if Pi Browser emits a localized string that can't be parsed, keep raw value so server can parse & return debug.
  - Build fix (Vercel): fixed a TS syntax issue in `lib/lottery/auth.ts` (missing closing `)` in a destructuring assignment before `.maybeSingle()`), which caused `Expected ',', got ';'` during `pnpm run build`.
- Now:
  - Provide new baseline zip for retest on Pi Browser: save lottery config must no longer hit DB NOT NULL `open_at`, and Vercel build must pass.
  - If it fails, screenshot the returned debug payload (it now includes the raw received time strings).

- Next:
  - If still FORBIDDEN: use the included debug payload to identify missing username header/query in Pi Browser.
  - If still INVALID_* time parsing: extend parser for the exact raw format shown in debug.

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/buy-sell-pi/page.tsx
  - app/buy-sell-pi/ui/BuySellPiClient.tsx
  - app/api/pi-exchange/rates/route.ts
  - app/api/admin/pi-exchange/rates/route.ts
  - SQL_BUY_SELL_PI_PRICES.sql

- 2026-01-14: PINETFIX10_EDITOR_UPDATEBY follow-up fixes.
  - Save/update `pi_exchange_updated_by` with a short label (prefer pi_username; else email local-part).
  - Display contact line "Liên hệ Mua - Bán Pi trực tiếp: 0938290578" on /buy-sell-pi.
  - Home page block now fetches live rates from GET /api/pi-exchange/rates instead of placeholder.
  - Fix: Home page block bug `j is not defined` when reading updated_at, which caused prices to fallback to "...".
    Home now correctly shows buy/sell + "Cập nhật: <time>" from the same API.
  - Root admin editor list loads via /api/admin/pi-exchange/editors; added tiny on-screen debug (Pi Browser).

- 2026-01-13: buy-sell-pi PINETFIX7: fix crash + perms/search stability.
  - Fix runtime crash on Pi App Studio: removed TDZ usage (canManageEditors used before init).
  - Permissions are now **server-verified only** on client UI:
    - Edit block renders only when rates API returns `can_edit_prices=true`.
    - Editor management renders only when rates API returns `can_manage_editors=true`.
    - No client-side fallback to isAdmin/username for gating UI.
  - Editor search: debounced live-search while typing + button search (same API), with on-screen debug errors for Pi Browser.

- 2026-04-16: Lottery /lucky-spin admin save.
  - Goal: root admin (hlong295) can save lottery config without `ADMIN_SAVE_FAILED`.
  - Fix (buildfix25): server route `/api/lottery/admin/config` now supports client payload `{ event, prizes }`.
    Previously it expected flat body fields (openAt/closeAt/drawAt) so it inserted `open_at = null` and hit NOT NULL constraint.
  - Fix (buildfix22):
    - Admin auth tolerant in Pi App Studio/Pi Browser: allow save when query param `pi_username=hlong295` is present,
      even if cookies are missing. Also normalized role column (`user_role` vs `role`) when reading from pi_users.
    - If event_id is missing (no existing lottery_events record), admin save creates a new event and returns the new id,
      then upserts prizes for that event.
    - API response includes compact debug fields to show on-screen (since Pi Browser has no console).
  - Working set:
    - lib/lottery/auth.ts
    - app/api/lottery/admin/config/route.ts
