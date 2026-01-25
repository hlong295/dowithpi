- Goal (incl. success criteria):
  - P3.1 — Siết “provider được duyệt mới được đăng” (server-side):
    - Provider chưa duyệt → không được tạo/sửa sản phẩm.
    - Chỉ owner/provider được sửa sản phẩm của mình.
    - Admin vẫn có quyền ẩn/bật (và xóa) qua server.
  - Không phá UI / không thêm UI thừa.
  - Không đụng luồng login Pi user + email/user đang OK.
  - PITD là tài sản nội bộ → mọi luồng quan trọng đi qua API server.
  - P3.2 — Luồng “thành viên thường đăng bài” (user-facing) + phí PITD đăng bài:
    - Approved provider: được đăng bài (miễn/giảm theo cấu hình).
    - User thường: đăng bài bị trừ PITD theo cấu hình.
    - Cấu hình phí nằm trong Admin > Quản lý PITD Token (root admin).

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
  - Baseline (input): dowithpi_P2p2_digital_fulfillment_PATCH_20260125.zip.
  - Current patch: P3.2 user post fee + provider discount rules (server-side) + admin fee settings.

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

  - Lottery UI: Banner "no new event" now checks **ACTIVE event** condition: status=open AND now within open_at..close_at AND not EVENT_NOT_OPEN; otherwise banner shows waiting messages, hides "ĐANG ĐĂNG KÝ" and hides registration count.

  - Lottery admin save hardening (open_at NOT NULL fix):
    - API /api/lottery/admin/config reads payload `{ event, prizes }` correctly.
    - Date parsing accepts datetime-local (`YYYY-MM-DDTHH:MM`) and common localized formats (`MM/DD/YYYY HH:MM` or `DD/MM/YYYY HH:MM`).
    - If open/close/draw is missing OR present-but-unparseable, return 400 with on-screen debug (no DB insert attempt).
    - Client-side datetime parsing: if Pi Browser emits a localized string that can't be parsed, keep raw value so server can parse & return debug.
  - Build fix (Vercel): fixed a TS syntax issue in `lib/lottery/auth.ts` (missing closing `)` in a destructuring assignment before `.maybeSingle()`), which caused `Expected ',', got ';'` during `pnpm run build`.
 - Now:
  - Ship new baseline ZIP for Pi Browser test: posting fee + provider discount and new /post page.

 - Next:
  - Run SQL migration to add 2 columns to app_settings.
  - Test cases: (1) user thường tạo sản phẩm → trừ PITD đúng, (2) user thiếu PITD → báo lỗi & không tạo sản phẩm, (3) provider_approved → phí theo provider fee (0 nếu mặc định), (4) admin tạo sản phẩm không trừ PITD.

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/api/internal/products/route.ts
  - app/api/admin/pitd-fees/route.ts
  - app/admin/pitd-management/page.tsx
  - app/post/page.tsx
  - SQL_P3P2_ADD_POST_FEES_TO_APP_SETTINGS.sql
  - app/api/internal/products/[id]/route.ts
  - app/admin/products/page.tsx
  - app/admin/products/add/page.tsx
  - app/admin/products/[id]/edit/page.tsx

- 2026-01-17: Lottery /lucky-spin banner “no event” UX.
  - Goal: When there is **no new/active lottery event**, the banner must:
    - Show: “Hiện chưa có chương trình xổ số mới, mời bạn chờ Chương trình mới”.
    - Hide the status pill (“ĐANG ĐĂNG KÝ”).
    - Countdown area shows: “Thân mời bạn chờ chương trình xổ số mới”.
    - Do **not** show “Đã đăng ký …” stats when there is no event.
  - Fix: `app/lucky-spin/page.tsx` banner now distinguishes `loading` vs `no event`:
    - If `!event && !loading`, renders the required messages + hides status/stats.

- 2026-01-17: Lottery /lucky-spin hide warning block + conditional Block #2.
  - Goal (per screenshot 27):
    - Hide Block #1 (warning card showing `EVENT_NOT_OPEN`).
    - Block #2 behavior:
      - If NOT logged in: show “Thân mời bạn đăng nhập để tham gia quay số trúng thưởng”.
      - If logged in and NO active lottery event: show “Mời bạn chờ chương trình xổ số mới” + button “Xem kết quả các kỳ quay số trước”.

  - 2026-01-17: Lottery archive per-kỳ metadata (mã kỳ quay + snapshot).
    - Goal: When admin creates a new lottery program, each event has a unique "mã kỳ quay" for archiving.
      Store per-event snapshot: draw time, participant count, winners, winning number.
    - Implementation:
      - `app/api/lottery/admin/config`: ensure `lottery_events.meta.event_code` exists (format: `LS-YYYYMMDD-HHMM-XXXX`) and `meta.draw_at` is stored.
      - `app/api/admin/lottery/start-draw`: after drawing, update `lottery_events.meta` with:
        - `participants_count`, `winning_number`, `winners[]`, `draw_completed_at`.
      - Admin UI: show "Mã kỳ quay" in "Quản trị: Cấu hình xổ số".
      - If logged in and HAS active event: keep current choose-number UI and show notice “Lưu ý: bạn chỉ có thể chọn số được 1 lần.”
  - Fix: `app/lucky-spin/page.tsx`
    - Treat “active event” strictly: status=open AND now within open_at..close_at AND ineligibleReason != EVENT_NOT_OPEN.
    - Hide Block #1 completely.
    - Block #2 now switches UI based on login + active-event state.
    - Added `id="lottery-history"` so the results button scrolls to history section.

- 2026-01-17: Lottery /lucky-spin reset registration count for NEW program + admin view entries list.
  - Goal:
    - When root admin saves a **new** lottery program config, banner stats ("Đã đăng ký x/y") must reset (do not carry over old registrations).
    - Add an admin-only section to view list of registered members + chosen numbers.
  - Fix:
    - `app/api/lottery/admin/config/route.ts`: if saving config on an existing event that already has registrations, server auto-creates a **new lottery_events row (new id)** instead of updating old event; keeps old entries for history; response returns `{created_new, new_event_id, prev_event_id}`.
    - `app/lucky-spin/page.tsx`: admin save message shows `(NEW_EVENT_CREATED)` when server creates a new event; admin UI adds a "Danh sách thành viên đã đăng ký" viewer using existing entries API.

- 2026-01-17: Lottery buildfix43 - Admin "Hủy sự kiện hiện tại" không có hiệu lực trên UI.
  - Root cause: `/api/lottery/event` chọn "event hiện tại" bằng cách lọc status `in (open,draft,closed)`. Khi admin hủy (status='cancelled') thì API rơi về event cũ (dẫn tới cảm giác "hủy không được").
  - Fix: `app/api/lottery/event/route.ts`
    - Luôn lấy **event mới nhất** theo `created_at desc` (không lọc status), sau đó xác định `eligible` theo window + status.
    - Nếu status = `cancelled` thì `eligible=false` và `ineligible_reason=EVENT_CANCELLED` (không cho tham gia dù window còn hiệu lực).

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

- 2026-01-16: Lottery timezone display + register UUID fix.
  - Fix35: Banner/member display uses **device local timezone**; admin config keeps using device-timezone input. No UI/login flow changes.
  - Fix36: `/api/lottery/register` (and related payout/admin routes) now correctly handle `resolveMasterUserId()` return shape `{ userId, created }` by destructuring `userId` before writing to DB.
    - Prevents: `invalid input syntax for type uuid: "{\"userId\":...}"` when inserting into `lottery_entries.user_id`.


## Patch note (2026-01-22)
- Fix: Admin/Provider edit product page failed to load after adding type dropdown due to missing helper `getItemTypeFromMedia`. Replaced with `inferItemType(product)` from `lib/product-type`.
- Files: app/admin/products/[id]/edit/page.tsx; app/provider/products/[id]/edit/page.tsx
- Baseline zip: dowithpi_P1_dropdown_type_fixed_editload_fix_v2.zip


## Patch note (2026-01-24) — P2.1 Voucher fulfillment (Professional services)
- Goal: When payment success (Pi hoặc PITD) cho item_type = voucher → server sinh `redeem_code`; user xem trong "Chi tiết đơn đổi"; provider/admin xác nhận USED.
- Added SQL: `SQL_VOUCHER_FULFILLMENTS.sql` (table `public.voucher_fulfillments`, RLS owner-read; server updates via service role).
- Server creates redeem_code:
  - `app/api/payments/pitd/route.ts`: after recording `user_purchases`, inferItemType(product) and create voucher_fulfillment.
  - `app/api/payments/complete/route.ts`: after inserting `user_purchases`, create voucher_fulfillment when voucher.
- New APIs:
  - `GET /api/purchases/[id]`: returns purchase + product + `voucher_fulfillment` (if voucher) + `canConfirmUsed`.
  - `POST /api/fulfillment/voucher/[purchaseId]/use`: provider owner (products.provider_id) or root admin marks voucher USED.
- New UI (minimal, no extra blocks):
  - New page `app/purchase/[id]/page.tsx` ("Chi tiết đơn đổi") shows redeem_code for voucher and confirm button for provider/admin.
  - Account "Sản phẩm đã mua" link now opens `/purchase/{purchase.id}`.

- 2026-01-25: P4.1 PITD Rules in Admin "Quản trị hệ thống → Quản lý PITD Token" (pitd-management)
  - DB: ran SQL_P4P1_ADD_PITD_RULES_TO_APP_SETTINGS.sql (added PITD rules columns to public.app_settings).
  - Build fix (Vercel): `CardHeader` runtime ReferenceError on `/admin/pitd-management`.
    - Root cause: `CardHeader` used but not imported from `@/components/ui/card`.
    - Fix: import `CardHeader/CardTitle/CardDescription/CardContent` alongside `Card`.
