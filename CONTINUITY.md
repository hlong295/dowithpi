- Goal (incl. success criteria):
  - Restructure home page: remove 8 category grid, flash sale/featured/new blocks; replace with 6 new feature blocks in 2-column layout.
  - Success: home displays 6 blocks (Mua-Bán Pi, Nạp PITD, Trao đổi, Từ thiện, Dịch vụ hỗ trợ, Khác) with icons, no product lists; PITD/Pi purchase flows remain intact.

- Constraints/Assumptions:
  - Do not change UI/strings except as explicitly required for new blocks.
  - Do not break Pi login/email login flows.
  - Do not break PITD/Pi purchase functionality (already working).
  - PITD is internal; all PITD ops must go through server API (no client anon direct writes).
  - No changes to authentication, payment APIs, or database structure.

- Key decisions:
  - Replace entire home page content: remove CATEGORIES grid, remove flashSale/featured/newProducts sections.
  - Add 6 new blocks in 2-column responsive grid with icons and Vietnamese descriptions.
  - Block 3.1 (Mua-Bán Pi): display live Pi/USDT and Pi/VND rates from OKX (if API available; placeholder if not).
  - Blocks 3.2-3.6: static blocks with icons and links/actions (to be defined).

- State:
  - Baseline: fix46 (branding DOWITHPI, PITD/Pi purchases working).
  - Current: restructuring home page per user request (fix47).

- Done:
  - Read current app/page.tsx structure.
  - Read CONTINUITY.md to understand constraints.

- Now:
  - Update app/page.tsx: remove category grid and product sections, add 6 feature blocks in 2-column layout.

- Next:
  - If OKX API integration is needed for live rates, add API route and fetch logic.
  - Test home page displays correctly without breaking existing flows.

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: OKX API endpoint/credentials for live Pi/USDT and Pi/VND rates (may need user to provide).
  - UNCONFIRMED: Exact actions/links for blocks 3.2-3.6 (may be placeholder buttons for now).

- Working set (files/ids/commands):
  - app/page.tsx
  - CONTINUITY.md
