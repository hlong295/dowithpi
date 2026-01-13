- Goal (incl. success criteria):
  - Add a simple inline "Chuyên gia tư vấn Pi" management flow directly on the **Dịch vụ hỗ trợ Pi** page.
  - Public view: **/support** shows 3 service blocks with icons and lists experts per category (only experts that admin set is_active=true).
  - Admin view: on the same **/support** page, admin can add/edit/delete experts and toggle show/hide.
  - **/buy-sell-pi** returns to the original placeholder ("Mua - Bán Pi" đang hoàn thiện).

- Constraints/Assumptions:
  - Chỉ sửa đúng yêu cầu; không phá UI ngoài phần thêm nội dung/khối chuyên gia như yêu cầu.
  - Không đụng luồng login Pi user + email/user đang chạy OK (chỉ dùng requireAdmin ở API).
  - PITD là tài sản nội bộ: không cho client đọc/ghi PITD trực tiếp trong luồng quan trọng.
  - Pi Browser có thể không có console ⇒ cho phép xem debug ngay trên trang.

- Key decisions:
  - Giải pháp đơn giản: quản trị chuyên gia ngay trên **/support** (không thêm tab/menu ở Quản trị hệ thống).
  - Tạo bảng DB riêng: public.pi_buy_sell_experts để lưu chuyên gia (category, username, phone, chat, pricing...).
- Public GET dùng API server (/api/pi-support/experts) để tránh vấn đề RLS.

- State:
  - Baseline: source zip user gửi = dowithpi_fix_provider_label_20260113.zip (current workspace).
  - Current: Implemented DB SQL + API + UI for experts on **/support**; restored **/buy-sell-pi** to placeholder.

-- Done:
  - Added public API: GET /api/pi-support/experts (grouped by category, active only).
  - Added admin API: /api/admin/pi-support-experts (GET/POST/DELETE) with requireAdmin.
  - Updated **/support** page to render 3 service blocks + public expert lists + inline admin panel (visible only to admin).
  - Restored **/buy-sell-pi** page to the original placeholder card (no expert admin UI).
  - Added DB error surfacing for admin upsert: API returns detailed error + hint (missing table / permission denied) and UI displays it (Pi Browser friendly).
  - Updated SQL_pi_buy_sell_experts.sql to include GRANTs for service_role (required for server-side upsert).
  - Fixed DB_ERROR "invalid input syntax for type numeric: \"\"" by normalizing empty-string fee inputs to NULL in admin upsert API.

- Now:
  - Fix admin panel visibility on /support: ensure only real admins see the add/update expert block (server-side admin API gating).

- Next:
  - User runs SQL_pi_buy_sell_experts.sql on Supabase.
  - Verify on Pi Browser: admin panel appears for root admin, and public list shows active experts.

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/buy-sell-pi/page.tsx
  - app/api/pi-support/experts/route.ts
  - app/api/admin/pi-support-experts/route.ts
  - SQL_pi_buy_sell_experts.sql
