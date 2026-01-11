# CONTINUITY LEDGER

## Goal
Fix critical UI navigation and PITD wallet display issues after recent refactor:
1. Avatar button in header must open AccountHubSheet immediately (currently broken)
2. PITD wallet UI must display balance, history, and all wallet data (currently shows 0 or broken)
3. Bottom navbar must show 5 items: Trang chủ, Trao đổi, Quay số (center), Nhiệm vụ, Hồ sơ
4. AccountHubSheet must contain ALL account functions (wallet, orders, admin menus) 
5. ProfilePage must be public profile (not account settings)
6. Add debug mode with ?debug=1 query param for on-screen debugging (Pi Browser has no console)

Success criteria:
- Tap avatar in header → AccountHubSheet opens with PITD wallet showing correct balance
- mrjqka user shows PROVIDER badge and correct PITD balance  
- HLong295 shows ROOT ADMIN badge and all admin menus
- Bottom nav "Hồ sơ" links to public profile page
- No admin features lost
- Optional debug overlay when ?debug=1 present

## Constraints/Assumptions
- DO NOT change authentication flows, API routes, or database schema
- PITD operations MUST use existing server API routes (/api/pitd/wallet, /api/pitd/transactions)
- Preserve all existing Admin and Provider functionality
- Keep current purple/pink gradient theme
- Copy old Account page sections verbatim into AccountHubSheet

## Key decisions  
- RootLayoutClient mounts AccountHubWrapper at root level for global access
- Header avatar button controls AccountHubSheet open/close state via prop drilling
- AccountHubWrapper is SMART component with wallet loading logic (copied from old account page)
- AccountHubSheet is DUMB presentational component receiving wallet data via props
- ProfilePage is new public profile for viewing user reputation/listings (placeholder for now)
- Debug mode uses URL query param (?debug=1) to show on-screen diagnostics

## State
- Current: AccountHub navigation partially wired but PITD wallet not displaying correctly
- PITD balance shows hardcoded 25 in header but AccountHubSheet shows 0 or loading forever
- Avatar button exists but AccountHubSheet may not be opening or loading wallet data

## Now
- Fix AccountHubWrapper wallet loading to trigger correctly when sheet opens
- Add console.log debug statements to track wallet loading flow
- Add on-screen debug overlay when ?debug=1 query param present
- Ensure Header avatar button properly triggers AccountHubWrapper open state
- Verify PITD wallet UI renders with actual balance from API

## Next
- Test with mrjqka account (should show PROVIDER badge + correct PITD balance)
- Test with HLong295 account (should show ROOT ADMIN + all admin menus)
- Remove debug console.logs after confirming fix
- Implement ProfilePage content (currently placeholder)

## Open questions
- UNCONFIRMED: Are fetch AbortErrors in logs causing wallet load failures?
- UNCONFIRMED: Is AccountHubSheet actually opening when avatar clicked?
- UNCONFIRMED: Is wallet API /api/pitd/wallet responding with correct data?

## Working set
- components/header.tsx (avatar button)
- components/root-layout-client.tsx (state management)
- components/account-hub-wrapper.tsx (wallet loading logic)
- components/account-hub-sheet.tsx (wallet UI rendering)
- app/layout.tsx (root layout)
- app/profile/page.tsx (public profile page)
