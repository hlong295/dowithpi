- Goal (incl. success criteria):
  - Tối ưu tốc độ load app trên Pi Browser, đặc biệt khi chạy qua Pi App Studio domain https://dowithpicbedecd1402.pinet.com.
  - Không phá UI, không thay đổi nội dung hiển thị; không làm hư login Pi user + email/user; không đụng PITD (PITD vẫn phải đi qua API route server).
  - Giảm số lượng request Supabase phát sinh từ trình duyệt Pi (client) trong các trang public (Home/Trao đổi).

- Constraints/Assumptions:
  - Chỉ làm đúng nội dung tối ưu loading; không thêm tính năng mới.
  - Có thể dùng cache ngắn hạn (seconds) để tăng tốc, nhưng không làm sai dữ liệu lâu.
  - Pi Browser không có console log ⇒ có thể surfacing debug qua UI nếu cần (hiện chưa bật mặc định).

- Key decisions:
  - Chuyển các truy vấn sản phẩm/review/provider ở Home và Exchange từ **client gọi Supabase** sang **API route server** để giảm latency qua Pi Browser/Pi proxy.
  - Thêm cache ngắn hạn ở CDN (Cache-Control s-maxage) và cache ngắn hạn ở sessionStorage để render nhanh khi người dùng quay lại.

- State:
  - Baseline (input): dowithpi_ok13126.zip (stable baseline as of 2026-01-13).
  - Current patch: performance-only patch (Home + Exchange feed moved to server API + short caching). No DB schema change.

- Done:
  - Added API feed routes:
    - GET /api/feed/home (server-side supabase queries; returns flash/featured/new products with providerName + rating)
    - GET /api/feed/exchange?filter=&search=&category= (server-side feed for Exchange page)
  - Updated app/page.tsx (Home) to fetch from /api/feed/home + sessionStorage cache (TTL 30s).
  - Updated app/exchange/page.tsx to fetch from /api/feed/exchange + sessionStorage cache (TTL 20s).
  - Added CDN cache headers on both feed APIs (short TTL with stale-while-revalidate).

- Now:
  - Package updated source zip for user to test on Vercel + Pi App Studio.

- Next:
  - User tests load speed on Pi Browser (pinet.com + dowithpi.com) and reports whether Home/Exchange feel faster.
  - If still slow: profile bundle size and defer heavy client scripts (only if requested).

- Open questions (UNCONFIRMED if needed):
  - None.

- Working set (files/ids/commands):
  - app/api/feed/home/route.ts
  - app/api/feed/exchange/route.ts
  - app/page.tsx
  - app/exchange/page.tsx
