- Goal (incl. success criteria):
  - FIX UI label on product cards/detail: show the correct account that posted the product (provider/business name), not the fallback “PITODO”.
    - Applies to: Home (Flash/Featured/New cards), Exchange page cards, Product detail page provider chip.
    - Success: provider label matches the product owner account (pi_users.pi_username or pi_users.provider_business_name) when products.provider_id is present.

- Constraints/Assumptions:
  - Do NOT change UI layout/styles; only replace the text value that is currently hardcoded/fallbacked to “PITODO”.
  - Do NOT touch Pi user login + email/user login flows (already working).
  - Do NOT add new endpoints; keep current data flow.
  - PITD is internal asset: no new client-side PITD reads/writes introduced.

- Key decisions:
  - Resolve provider display name by mapping products.provider_id → pi_users (provider_business_name || pi_username).
  - Keep existing fallback order: product.provider_name / merchant_username (if present) → mapped pi_users name → “PITODO”.

- State:
  - Baseline: fix pinet login v2 / stable baseline where Pi + PITD flows work.
  - Current: Provider name resolution implemented for Home, Exchange, and Product detail.

- Done:
  - app/page.tsx: build providerNameMap from pi_users for fetched products; providerName uses mapped value.
  - app/exchange/page.tsx: build providerNameMap per fetched list; providerName uses mapped value.
  - lib/supabase/queries.ts (getProductById): resolve provider name via pi_users lookup using provider_id; providerName uses resolved value.

- Now:
  - Ready for user test in Pi Browser: verify provider label under product card and in product detail shows the posting account.

- Next:
  - If provider_id column name differs in DB, adjust mapping key (UNCONFIRMED until user test).
  - If pi_users is not readable from client due to RLS, switch to server API enrichment (UNCONFIRMED until user test).

- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Exact product owner column in products table (assumed provider_id).
  - UNCONFIRMED: RLS on pi_users allows client read of id/pi_username/provider_business_name for display.

- Working set (files/ids/commands):
  - app/page.tsx
  - app/exchange/page.tsx
  - lib/supabase/queries.ts
  - CONTINUITY.md
