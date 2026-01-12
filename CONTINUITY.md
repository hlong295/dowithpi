- Goal (incl. success criteria):
  - Trang **/support (Dịch vụ hỗ trợ Pi)** hiển thị nội dung chuyên nghiệp theo 3 nhóm dịch vụ (KYC/Mainnet, Pi Node, Tư vấn/giải đáp) với icon minh họa theo từng block.
  - Danh sách **Pioneer uy tín (Admin chọn)** hiển thị đúng theo cấu hình của root/admin (chọn thành viên trong app, gắn lĩnh vực, phí Pi/PITD/miễn phí, ghi chú), không còn placeholder.
  - Không phá UI ngoài phạm vi trang /support và trang cấu hình admin; không đụng luồng login Pi user + email/user.

- Constraints/Assumptions:
  - Chỉ sửa đúng yêu cầu: nội dung + cơ chế admin chọn thành viên hiển thị ở /support.
  - Không thay đổi các màn hình/luồng khác; không thay Supabase setup; không cho client ghi/đọc PITD trong luồng quan trọng.
  - Pi Browser có thể không có console ⇒ ưu tiên hiển thị lỗi/debug ngay trên trang khi cần.
  - Cấu hình danh sách chuyên gia phải lưu bền vững (DB), không hard-code.

- Key decisions:
  - Tạo bảng **public.pi_support_experts** để lưu cấu hình expert (user_id, areas, charge_mode, price_pi/price_pitd, note, is_active...).
  - Trang /support lấy danh sách expert qua **/api/pi-support/experts** (server, service-role) và chỉ trả về expert đang active.
  - Root/Admin quản lý danh sách expert qua trang **/admin/pi-support** và API **/api/admin/pi-support-experts** (server, yêu cầu admin).

- State:
  - Baseline: source zip gần nhất trước thay đổi này = pitodo_fix_support_page_content.zip.
  - Current: support page + admin expert config + DB schema file đã thêm.

- Done:
  - app/support/page.tsx: layout chuyên nghiệp theo block + icon; load danh sách expert động; có debug qua ?debug=1.
  - app/api/pi-support/experts/route.ts: public read-only endpoint trả expert active (service-role).
  - app/api/admin/pi-support-experts/route.ts: admin CRUD expert (requireAdmin + service-role).
  - app/admin/pi-support/page.tsx: UI để root/admin chọn thành viên và cấu hình lĩnh vực + phí + ghi chú + trạng thái.
  - sql/20260112_pi_support_experts.sql: script tạo bảng + trigger updated_at.

- Now:
  - Đóng gói source code cập nhật (zip) để user tải.

- Next:
  - User chạy SQL tạo bảng pi_support_experts trên Supabase.
  - Root/admin vào /admin/pi-support để chọn thành viên và cấu hình; kiểm tra /support hiển thị đúng.

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Supabase project đã bật pgcrypto (gen_random_uuid) chưa; nếu thiếu cần bật extension.

- Working set (files/ids/commands):
  - app/support/page.tsx
  - app/admin/pi-support/page.tsx
  - app/api/pi-support/experts/route.ts
  - app/api/admin/pi-support-experts/route.ts
  - sql/20260112_pi_support_experts.sql