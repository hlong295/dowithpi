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

- Now:
  - User runs SQL_BUY_SELL_PI_PRICES.sql on Supabase (if columns missing), then test update/read on /buy-sell-pi.

- Next:
  - If needed: wire the Home "Mua - Bán Pi" block to read prices (ONLY if requested).

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/buy-sell-pi/page.tsx
  - app/buy-sell-pi/ui/BuySellPiClient.tsx
  - app/api/pi-exchange/rates/route.ts
  - app/api/admin/pi-exchange/rates/route.ts
  - SQL_BUY_SELL_PI_PRICES.sql
