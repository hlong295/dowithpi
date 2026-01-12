- Goal (incl. success criteria):
  - Add Pi-exchange block behavior on product detail: show **Đổi bằng Pi** button when enabled; otherwise show temporary-unavailable message. Root admin (hlong295) can enable Pi exchange (client flag).
- Constraints/Assumptions:
  - Chỉ sửa đúng yêu cầu: thay textarea mô tả chi tiết thành WYSIWYG + render mô tả ở trang chi tiết.
  - Không thay đổi các màn hình/luồng khác; không thay Supabase setup; không cho client ghi/đọc PITD trong luồng quan trọng.
  - Pi Browser có thể không có console ⇒ nếu cần debug thì hiển thị ngay trên trang (bật bằng ?debug=1).

- Key decisions:
  - Dùng **contentEditable editor** nhẹ (không thêm thư viện nặng) + toolbar cơ bản để copy/paste giữ định dạng.
  - Lưu mô tả dưới dạng **HTML đã sanitize** (allowlist tag) để an toàn.
  - Trang chi tiết sản phẩm render mô tả bằng `dangerouslySetInnerHTML` với HTML đã sanitize.

- State:
  - Baseline: source zip hiện tại user gửi = dowithpi.zip.
  - Current: WYSIWYG product description implemented.

- Done:
  - app/product/[id]/page.tsx: add client-side flag `pitodo_pi_exchange_enabled`; if disabled then replace Pi button with message; root admin shows a single enable button.
  - lib/translations.ts: add keys `enablePiExchange` and `piExchangeTemporarilyDisabled` (vi/en).
  - FIX: Editor mô tả chi tiết có toolbar rõ ràng (Bold/Italic/Underline/Bullet/Number/Link/Undo/Redo) + thêm nút **Bảng** (chèn table).
  - FIX: sanitizeHtml cho phép table/tr/td/th và colspan/rowspan; trang chi tiết thêm CSS render bảng đẹp.
  - components/ui/rich-text-editor.tsx: WYSIWYG editor + toolbar + paste sanitize + optional debug.
  - lib/sanitize-html.ts: normalize/sanitize HTML (block scripts/events/javascript: URLs).
  - app/provider/products/add/page.tsx: thay textarea mô tả chi tiết -> RichTextEditor.
  - app/provider/products/[id]/edit/page.tsx: thay textarea mô tả chi tiết -> RichTextEditor.
  - FIX: crash "RichTextEditor is not defined" bằng cách import đúng component ở 2 trang Provider; RichTextEditor hỗ trợ prop id.
  - app/product/[id]/page.tsx: render mô tả bằng HTML đã sanitize (list/link/đậm giữ đúng định dạng).
  - FIX PITD payment 400 USER_NOT_FOUND (email/user): components/exchange-modal.tsx gửi thêm header **x-user-id** khi gọi `/api/payments/pitd` để server PITD route nhận đúng user trong môi trường không có cookie/localStorage session.

- Now:
  - Package updated source code zip for user.

- Next:
  - User test: vào /provider/products/add hoặc /provider/products/[id]/edit → dán mô tả có bullet/đậm/link → lưu.
  - Mở trang chi tiết sản phẩm → xác nhận mô tả hiển thị đúng định dạng.

- Open questions (UNCONFIRMED if needed):
  - Không.

- Working set (files/ids/commands):
  - components/ui/rich-text-editor.tsx
  - lib/sanitize-html.ts
  - app/provider/products/add/page.tsx
  - app/provider/products/[id]/edit/page.tsx
  - app/product/[id]/page.tsx