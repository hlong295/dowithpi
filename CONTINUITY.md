- Goal (incl. success criteria):
  - Ô nhập **Mô tả chi tiết** khi đăng/sửa sản phẩm là **WYSIWYG** (copy/paste giữ định dạng), lưu HTML an toàn.
  - Trang chi tiết sản phẩm hiển thị mô tả theo đúng định dạng (list/đậm/ngắt dòng/link) mà không đổi bố cục UI.
  - Không phá UI ngoài phạm vi ô mô tả; không đụng luồng login Pi user + email/user; không thay logic PITD.

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
  - FIX: Editor mô tả chi tiết có toolbar rõ ràng (Bold/Italic/Underline/Bullet/Number/Link/Undo/Redo) + thêm nút **Bảng** (chèn table).
  - FIX: sanitizeHtml cho phép table/tr/td/th và colspan/rowspan; trang chi tiết thêm CSS render bảng đẹp.
  - components/ui/rich-text-editor.tsx: WYSIWYG editor + toolbar + paste sanitize + optional debug.
  - lib/sanitize-html.ts: normalize/sanitize HTML (block scripts/events/javascript: URLs).
  - app/admin/products/add/page.tsx: thay textarea mô tả chi tiết -> RichTextEditor.
  - app/admin/products/[id]/edit/page.tsx: thay textarea mô tả chi tiết -> RichTextEditor.
  - app/product/[id]/page.tsx: render mô tả bằng HTML đã sanitize (list/link/đậm giữ đúng định dạng).

- Now:
  - Đóng gói source code cập nhật (zip) để user tải.

- Next:
  - User test: vào /admin/products/add (hoặc edit) → dán mô tả có bullet/đậm/link → lưu.
  - Mở trang chi tiết sản phẩm → xác nhận mô tả hiển thị đúng định dạng.

- Open questions (UNCONFIRMED if needed):
  - Không.

- Working set (files/ids/commands):
  - components/ui/rich-text-editor.tsx
  - lib/sanitize-html.ts
  - app/admin/products/add/page.tsx
  - app/admin/products/[id]/edit/page.tsx
  - app/product/[id]/page.tsx