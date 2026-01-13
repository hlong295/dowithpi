- Goal (incl. success criteria):
  - Add a simple inline "Chuyên gia tư vấn Pi" management flow directly on the Buy/Sell Pi page.
  - Public view: /buy-sell-pi shows 3 service blocks with icons and lists experts per category (only experts that admin set is_active=true).
  - Admin view: on the same /buy-sell-pi page, admin can add/edit/delete experts and toggle show/hide.

- Constraints/Assumptions:
  - Chỉ sửa đúng yêu cầu; không phá UI ngoài phần thêm nội dung/khối chuyên gia như yêu cầu.
  - Không đụng luồng login Pi user + email/user đang chạy OK (chỉ dùng requireAdmin ở API).
  - PITD là tài sản nội bộ: không cho client đọc/ghi PITD trực tiếp trong luồng quan trọng.
  - Pi Browser có thể không có console ⇒ cho phép xem debug ngay trên trang.

- Key decisions:
  - Giải pháp đơn giản: quản trị chuyên gia ngay trên /buy-sell-pi (không thêm tab/menu ở Quản trị hệ thống).
  - Tạo bảng DB riêng: public.pi_buy_sell_experts để lưu chuyên gia (category, username, phone, chat, pricing...).
  - Public GET dùng API server (/api/pi-exchange/experts) để tránh vấn đề RLS.

- State:
  - Baseline: source zip user gửi = dowithpi_fix_provider_label_20260113.zip (current workspace).
  - Current: Implemented DB SQL + API + UI for experts on /buy-sell-pi.

- Done:
  - Added public API: GET /api/pi-exchange/experts (grouped by category, active only).
  - Added admin API: /api/admin/pi-exchange/experts (GET/POST/DELETE) with requireAdmin.
  - Updated /buy-sell-pi page to render 3 service blocks + public expert lists + inline admin panel (visible only to admin).
  - Fixed admin panel visibility on Pi Browser: UI uses client-side role/username (hlong295) via auth-context, not API probe; API still enforces requireAdmin.
  - Fixed admin create/update/delete expert returning UNAUTHENTICATED on Pi Browser: admin requests now send fallback header x-pi-user-id from auth-context.

- Now:
  - Package updated source code as a ZIP for user to download.

- Next:
  - User runs SQL_pi_buy_sell_experts.sql on Supabase.
  - Verify on Pi Browser: admin panel appears for root admin, and public list shows active experts.

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/buy-sell-pi/page.tsx
  - app/api/pi-exchange/experts/route.ts
  - app/api/admin/pi-exchange/experts/route.ts
  - SQL_pi_buy_sell_experts.sql