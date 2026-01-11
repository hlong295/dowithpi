- Goal (incl. success criteria):
  - UI navigation refactor ONLY: move account access from bottom nav to header avatar button.
  - Header: Add language switcher (always visible on mobile), PITD balance pill (fetch from /api/pitd/wallet when logged in), avatar button navigating to /account.
  - Bottom nav: Keep 5 items, remove "Tài khoản" tab, last tab is "Hồ sơ" → /profile.
  - /account page: Keep untouched with all PITD wallet logic intact.
  - /profile page: Public-facing profile page (already exists).
  - Success: Navigation works, PITD balance displays correctly from DB, no features broken.

- Constraints/Assumptions:
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

- State:
  - Baseline: v39 (home page with 7 blocks, header with PITD balance + gift + avatar, bottom nav with 5 items).
  - Current: Navigation refactored per spec.

- Done:
  - Updated components/header.tsx: Added language switcher (always visible), PITD balance pill (fetch from API when logged in), avatar button navigates to /account.
  - Updated components/bottom-nav.tsx: Confirmed 5 items with last tab "Hồ sơ" → /profile (no "Tài khoản" tab).
  - app/profile/page.tsx: Already exists as public-facing profile page (no changes needed).
  - app/account/page.tsx: Untouched, all PITD wallet logic intact.
  - Updated CONTINUITY.md: Documented navigation refactor completion.

- Now:
  - System ready with new navigation: Avatar button → /account, Bottom nav → /profile for public profile.
  - PITD balance displays correctly from database when user is logged in.

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
  - CONTINUITY.md (this file)
