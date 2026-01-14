- Goal (incl. success criteria):
  - Hoàn thiện trang **Mua - Bán Pi** (/buy-sell-pi): hiển thị **giá mua/giá bán Pi (VND)** + **thời gian cập nhật** theo UI hiện có, tối ưu mobile.
  - Admin (server-verified) có thể cập nhật trực tiếp giá mua/giá bán ngay trên trang; người dùng thường chỉ xem.
  - Không phá UI phần khác; không làm hư login Pi user + email/user; PITD vẫn server-only qua API route.

- Constraints/Assumptions:
  - Chỉ làm đúng phạm vi Mua - Bán Pi; không chỉnh các trang/blocks khác.
  - Pi Browser không có console log ⇒ có thể hiển thị debug nhỏ (non-invasive) trong khối admin.
  - Lưu giá vào DB (app_settings). Nếu DB chưa có cột, cần chạy SQL bổ sung.

- Key decisions:
  - Lưu giá mua/giá bán Pi ở **public.app_settings** (cột: pi_buy_price_vnd, pi_sell_price_vnd) để tránh tạo bảng mới.
  - Public đọc qua GET /api/pi-exchange/rates; admin cập nhật qua POST /api/admin/pi-exchange/rates (server-side requireAdmin).

- State:
  - Baseline (input): dowithpi_perf_patch_20260113.zip.
  - Current patch: add Buy/Sell Pi rates page + APIs. DB requires 2 optional columns on app_settings.

- Done:
  - Implemented Buy/Sell Pi rates UI (shows buy/sell VND + updated time; admin-only editor section).
  - Pi App Studio compatibility: render /buy-sell-pi **client-only (ssr:false)**; make page.tsx a **Client Component ("use client")** to satisfy Next.js build constraints to avoid "Application error: a client-side exception"; added an error boundary that shows a small on-screen debug message only if the page crashes.
  - Added public API: GET /api/pi-exchange/rates.
  - Added admin API: POST /api/admin/pi-exchange/rates (requires admin; updates app_settings).
  - Added SQL helper: SQL_BUY_SELL_PI_PRICES.sql (adds pi_buy_price_vnd, pi_sell_price_vnd).
  - Build fix: rewrote PageErrorBoundary type generics into named Props/State types to avoid TSX parser ambiguity on Vercel.

  - Fix: BuySellPiClient fetch URLs for editors + user-search (previously corrupted => list empty).
  - Add: API rates returns updated_by_label; UI shows "Cập nhật bởi: <pi_username/email>".
  - Add SQL: app_settings.pi_exchange_updated_by (uuid) to persist last editor.
- Now:
  - User runs SQL_BUY_SELL_PI_PRICES.sql on Supabase (if columns missing), then test update/read on /buy-sell-pi.

- Next:
  - If needed: refine editor label resolution for special cases (UNCONFIRMED).

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
