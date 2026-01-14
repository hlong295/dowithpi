# CONTINUITY LEDGER (compaction-safe)

## Goal (incl. success criteria)
- Buy/Sell Pi works end-to-end:
  - Root admin (hlong295) can update prices.
  - Granted editor (e.g., mrjqka) can update prices.
  - Latest update displays: "Cập nhật bởi: <pi_username/email>".
  - Root admin sees list of granted editors and can revoke each.
  - Prices + editor list persist across deploys.

## Constraints/Assumptions
- No UI changes beyond showing already-requested fields.
- Do not break Pi/email login.
- All sensitive operations use server API routes (Supabase admin client), no PITD client writes.

## Key decisions
- Treat app_settings as a singleton row with id=1.
- If older builds inserted a non-1 row, copy its values into id=1 on first read.
- Permission to update price: root/admin OR userId included in app_settings.pi_exchange_editor_ids.

## State
- Baseline source: dowithpi_buy_sell_pi_patch_20260114_PINETFIX14_STABLE.zip

## Done
- Fixed requireUser misuse in /api/pi-exchange/rates/update (requireUser returns userId string).
- Fixed singleton persistence (upsert id=1) in rates and editors APIs.

## Now
- Verify on Vercel + Pi Browser:
  - Root admin can update and sees editors list.
  - Editor can update.
  - "Cập nhật bởi" shows correctly.

## Next
- None.

## Working set
- app/api/pi-exchange/rates/route.ts
- app/api/pi-exchange/rates/update/route.ts
- app/api/admin/pi-exchange/editors/route.ts
