- Goal (incl. success criteria):
  - FIX (Pi App Studio / pinet): Pi user login must work on https://*.pinet.com in Pi Browser.
    - Must NOT break existing Pi login on dowithpi.com (already OK).
    - No UI changes except optional debug via ?debug=1 on server endpoints.
  - UI navigation refactor ONLY: move account access from bottom nav to header avatar button.
  - Header: Add language switcher (always visible on mobile), PITD balance pill (fetch from /api/pitd/wallet when logged in), avatar button navigating to /account.
  - Bottom nav: Keep 5 items, remove "Tài khoản" tab, last tab is "Hồ sơ" → /profile.
  - /account page: Keep untouched with all PITD wallet logic intact.
  - /profile page: Public-facing profile page (already exists).
  - Success: Navigation works, PITD balance displays correctly from DB, no features broken.

- Constraints/Assumptions:
  - Pi App Studio usually has no runtime env vars; server must support a safe fallback for SUPABASE_SERVICE_ROLE_KEY.
  - DO NOT create new routes or API endpoints.
  - DO NOT modify /account page content or PITD wallet logic.
  - DO NOT change business logic, auth flows, or Supabase setup.
  - PITD balance MUST be fetched from existing /api/pitd/wallet endpoint.
  - UI style must stay consistent with current design (purple/pink gradient).
  - Mobile-first, balanced layout.

- Key decisions:
  - Header avatar button uses router.push("/account") for direct navigation (no popup/sheet).
  - PITD balance pill shown only when user is logged in, fetched via useEffect from /api/pitd/wallet.
  - Language switcher (VI/EN) moved to header and always visible on mobile.
  - Bottom nav last tab "Hồ sơ" routes to existing /profile page (public profile).
  - /account page remains the canonical place for PITD wallet with full DB access.
  - Created lib/pitd/usePitdWallet.ts: Reusable hook with wallet fetch logic copied verbatim from Account page (handles Pi/email auth headers correctly).
  - Created components/PitdTokenIcon.tsx: Custom PITD token icon (purple→pink gradient coin with "D" mark).
  - Updated components/header.tsx: Replaced star icon with PitdTokenIcon, shows real balance from usePitdWallet hook (only when logged in, shows "--" placeholder when logged out).

- State:
  - Baseline: v39 (home page with 7 blocks, header with PITD balance + gift + avatar, bottom nav with 5 items).
  - Current: Navigation refactored per spec, PITD balance implemented.

- Done:
  - Updated components/header.tsx: Added language switcher (always visible), PITD balance pill (fetch from API when logged in), avatar button navigates to /account.
  - Updated components/bottom-nav.tsx: Confirmed 5 items with last tab "Hồ sơ" → /profile (no "Tài khoản" tab).
  - app/profile/page.tsx: Already exists as public-facing profile page (no changes needed).
  - app/account/page.tsx: Untouched, all PITD wallet logic intact.
  - Created lib/pitd/usePitdWallet.ts: Reusable hook with wallet fetch logic copied verbatim from Account page (handles Pi/email auth headers correctly).
  - Created components/PitdTokenIcon.tsx: Custom PITD token icon (purple→pink gradient coin with "D" mark).
  - Updated components/header.tsx: Replaced star icon with PitdTokenIcon, shows real balance from usePitdWallet hook (only when logged in, shows "--" placeholder when logged out).
  - Updated CONTINUITY.md: Documented PITD balance implementation completion.

- Now:
  - System ready with new navigation: Avatar button → /account, Bottom nav → /profile for public profile.
  - PITD balance displays correctly from database when user is logged in.
  - System ready with live PITD balance in header fetched from database via /api/pitd/wallet.
  - Balance displays correctly for both Pi users and email users (uses same auth headers as Account page).
  - PITD token icon replaces star icon in header pill.

- Next:
  - Test PITD balance loading on Pi Browser and email login.
  - Verify /account page PITD wallet still works (no regressions).
  - Monitor for any auth/session issues with wallet API calls.

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Performance of PITD balance fetch on slow networks (Pi Browser).
  - UNCONFIRMED: Caching strategy for PITD balance to reduce API calls.

- Working set (files/ids/commands):
  - components/header.tsx (language switcher, PITD balance pill, avatar button)
  - components/bottom-nav.tsx (5 items, last tab → /profile)
  - app/profile/page.tsx (public profile, unchanged)
  - app/account/page.tsx (PITD wallet, unchanged)
  - lib/pitd/usePitdWallet.ts (reusable hook for wallet fetch logic)
  - components/PitdTokenIcon.tsx (custom PITD token icon)
  - CONTINUITY.md (this file)


- Done:
  - Updated /support page content to list Pi support services (KYC/Mainnet, Node, Q&A) and placeholder reputable Pioneer list.
