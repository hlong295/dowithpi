# CONTINUITY — PITODO / DoWithPi

## Working set
- Repo: `hlong295/dowithpiDeploy`
- Vercel project: `dowithpi` (domain: `dowithpi.com`)

## Baseline patch status
- Baseline trước đó: **patch 26 (2026-01-04)** ổn định về Pi login + master user + ví PITD.
- Baseline hiện tại (phase 1 admin members): chuỗi patch `dowithpi_phase1_admin_members_PATCHED_fix*`.

## Database baseline (đang dùng để làm chuẩn)
Các bảng quan trọng đã export CSV để ghi nhớ baseline:
- `public.users`
- `public.pi_users`
- `public.pitd_wallets`
- `public.pitd_transactions`
- `public.products`
- `public.user_favorites`
- `public.user_purchases`

Ghi chú: `public.product_media` hiện chưa có dữ liệu (query trả “Success. No rows returned”) — sẽ xử lý sau.

## Phase 1 — Quản lý thành viên (Admin) (ưu tiên cao)
Mục tiêu:
- 4.1 Khóa tạm thời / vĩnh viễn
- 4.2 Duyệt Provider (workflow chờ duyệt -> phê duyệt)
- 4.3 Label thành viên uy tín / thường
- 4.4 Label nhà cung cấp uy tín / đã xác thực / chưa xác thực

Ràng buộc bắt buộc:
- Không phá UI/không thêm bớt hiển thị.
- Không đụng luồng login Pi user + email/user đang chạy OK (chỉ bọc verify/permission ở server).
- PITD là tài sản nội bộ: các luồng quan trọng không cho client đọc/ghi trực tiếp bằng anon key; PITD đi qua API server.

## Những gì đã fix tới fix16
- Trang **Quản lý thành viên** đã hiển thị đúng danh sách Pi Users + Email Users.
- Set/hủy quyền Provider đã hoạt động.
- Workflow Provider:
  - Set Provider -> vào **Nhà cung cấp chờ duyệt** -> Admin phê duyệt -> chuyển sang **Nhà cung cấp đã duyệt**.

## Bug còn lại (sau fix16)
- Sau khi Admin phê duyệt (ví dụ user `mrjqka`), vào **Trang tài khoản** của user vẫn hiển thị role **REDEEMER** và **không có nút/luồng đăng bài sản phẩm**.

Nguyên nhân chính:
- `lib/auth-context.tsx` đang cache kết quả `/api/auth/ensure-user` trong `sessionStorage` theo key `piuser_{authUser.id}` và **không có TTL** → user vẫn dùng dữ liệu cũ (role cũ) dù DB đã update.

## Patch mới: fix17 (provider role refresh)
- Thêm TTL ngắn cho cache ensure-user (3 giây) để tránh 429 nhưng vẫn **nhận cập nhật role nhanh** sau các thay đổi quyền.
- Format cache mới: `{ t: <timestamp>, data: <piUserData> }`.
- Fix bug trong `app/api/auth/ensure-user/route.ts` (biến `body` chưa được định nghĩa): parse JSON vào `body` rồi lấy `{ userId, email, metadata }`.

Kỳ vọng sau fix17:
- User `mrjqka` sau khi được Admin phê duyệt provider sẽ thấy `userRole = provider` trên trang tài khoản, từ đó hiện đúng nút/luồng đăng bài.

## 2026-01-08 — Phase 1 Admin Members — FIX19 (labels update missing requesterId/targetUserId)
**Issue:** Updating member/provider labels showed `Missing requesterId/targetUserId` (and provider label update sometimes didn't apply) because:
- `set_member_label` / `set_provider_label` calls in `app/admin/members/page.tsx` sent `userId` instead of `targetUserId`, and sometimes used a non-normalized requester id.
- `app/admin/providers/page.tsx` label update used `requesterId = user.id` (could be undefined in Pi Browser auth object) and sent `provider_label` instead of `providerLabel`.

**Fix (code-only, no UI changes):**
- `app/admin/members/page.tsx`: use `getRequesterId()` for label updates; send `targetUserId` (not `userId`) in POST body for label actions.
- `app/admin/providers/page.tsx`: add `getRequesterId(user)` helper; use it for requesterId; send `providerLabel` (not `provider_label`) to `/api/admin/members/update`.

**Patch zip:** `dowithpi_phase1_admin_members_PATCHED_fix19_labels_requester_target_ids.zip`
