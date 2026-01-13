- Goal (incl. success criteria):
  - FIX: Product cards and product detail must show the correct provider account (username/business name) instead of the default "PITODO" on: Home, Exchange, Product detail.
- Constraints/Assumptions:
  - Chỉ sửa đúng yêu cầu; không phá UI; không đụng luồng login Pi/email đang OK.
  - PITD là tài sản nội bộ: không cho client đọc/ghi PITD trực tiếp trong luồng quan trọng (PITD phải đi qua API server).
  - Pi Browser có thể không có console ⇒ nếu cần debug thì hiển thị ngay trên trang (bật bằng ?debug=1).

- Key decisions:
  - Resolve provider display name by mapping `products.provider_id -> pi_users (provider_business_name || pi_username)`; fallback to existing fields; only affects displayed provider label.

- State:
  - Baseline: source zip user gửi = dowithpi_13126.zip
  - Current: Working on provider label fix (Home/Exchange/Product detail).

- Done:
  - UNCONFIRMED: WYSIWYG product description implemented (from previous ledger).

- Now:
  - Patch Home + Exchange list formatting to resolve provider display names from `pi_users` by `provider_id` (avoid default "PITODO").
  - Patch getProductById to resolve provider display name and return providerId; patch product detail to use providerId from data.

- Next:
  - Zip updated source and provide download link.
  - If Pi Browser still shows PITODO, check whether `pi_users` select is blocked by RLS; if so, move provider lookup into a public API route (server) that returns only safe public fields.

- Open questions (UNCONFIRMED if needed):
  - Does RLS allow public select on `pi_users (id, pi_username, provider_business_name)`? If denied, provider name lookup must be done server-side.

- Working set (files/ids/commands):
  - app/page.tsx
  - app/exchange/page.tsx
  - lib/supabase/queries.ts (getProductById)
  - app/product/[id]/page.tsx
