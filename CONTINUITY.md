- Goal (incl. success criteria):
  - Restructure home page: remove 8 category grid, flash sale/featured/new blocks; replace with 6 new feature blocks in 2-column layout.
  - Success: home displays 6 blocks (Mua-Bán Pi, Nạp PITD, Trao đổi, Từ thiện, Dịch vụ hỗ trợ, Địa điểm trao đổi Pi) with icons, product lists retained; PITD/Pi purchase flows remain intact.
  - NEW: Header now has 2-tier UX (PITD balance pill + Gift icon with notification badge + status message) and bottom navbar has 5 buttons with Lucky Spin center button (floating, larger, with FREE badge).

- Constraints/Assumptions:
  - Do not change UI/strings except as explicitly required for new blocks.
  - Do not break Pi login/email login flows.
  - Do not break PITD/Pi purchase functionality (already working).
  - PITD is internal; all PITD ops must go through server API (no client anon direct writes).
  - No changes to authentication, payment APIs, or database structure.

- Key decisions:
  - Replace entire home page content: remove CATEGORIES grid, keep flashSale/featured/newProducts sections.
  - Add 7 blocks (1 full-width Lucky Spin + 6 feature blocks in 2-column grid) with icons and Vietnamese descriptions.
  - Block "Quay số trúng thưởng": full-width, gradient cam-đỏ, FREE badge, link to /lucky-spin.
  - Block "Mua-Bán Pi": display admin-editable buy/sell prices (placeholder "..." for now).
  - Block "Nạp PITD": emphasize PITD security + 3 ways to earn PITD (check-in, quay số, hoạt động).
  - Block "Trao đổi hàng hóa dịch vụ": use Pi/PITD to exchange goods.
  - Block "Quỹ Từ Thiện - Ủng Hộ": donate via Pi.
  - Block "Dịch vụ hỗ trợ Pi": KYC & Pi Network knowledge.
  - Block "Địa điểm trao đổi Pi": find Pi exchange locations nearby.
  - Header upgrade: 2-tier (logo + PITD balance + gift icon with notification, search row below, dynamic status message).
  - Bottom navbar upgrade: 5 buttons (Home, Exchange, Lucky Spin [center, floating, larger], Activity, Profile).

- State:
  - Baseline: fix46 (branding DOWITHPI, PITD/Pi purchases working).
  - Current: restructured home page + upgraded header/navbar UX (fix47).

- Done:
  - Updated app/page.tsx: added Lucky Spin block (full-width) + 6 feature blocks in 2-column layout with proper icons and Vietnamese content.
  - Updated components/header.tsx: added PITD balance pill, Gift icon with notification badge, dynamic status message (spin reminder).
  - Updated components/bottom-nav.tsx: added Lucky Spin as center button (floating, larger, gradient, FREE badge when not spun).
  - Updated lib/translations.ts: added navLuckySpin translation for Vietnamese and English.
  - Updated logo from /dowithpi-logo.png to /pitodo-logo.png with "PI TO DO" branding.
  - Changed app name from "DOWITHPI" to "DO WITH PI" in translations.
  - Adjusted block text sizes, layout (vertical stack with full-width descriptions), and content per user feedback.
  - Section headers (Flash Sale, Sản Phẩm Nổi Bật, Sản Phẩm Mới) font size reduced to text-lg for mobile optimization.

- Now:
  - System ready with new UX: header shows live PITD balance + daily spin status, navbar emphasizes Lucky Spin engagement.

- Next:
  - Create /lucky-spin page for lottery functionality.
  - Create /pitd page for PITD token management and earning history.
  - Implement backend logic for daily check-in and lucky spin rewards.
  - Add admin panel for updating Pi buy/sell prices.
  - Integrate actual PITD balance from database/API.

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Backend API for daily spin/check-in status and reward distribution.
  - UNCONFIRMED: Admin interface for updating Pi buy/sell prices in Block "Mua-Bán Pi".
  - UNCONFIRMED: Database schema for tracking user daily activities (spin, check-in).

- Working set (files/ids/commands):
  - app/page.tsx (home page with 7 blocks)
  - components/header.tsx (2-tier header with PITD + status)
  - components/bottom-nav.tsx (5-button navbar with center Lucky Spin)
  - lib/translations.ts (added navLuckySpin)
  - public/pitodo-logo.png (new logo)
  - CONTINUITY.md (this file)
