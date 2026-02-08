#!/usr/bin/env bash
set -euo pipefail

# TSBIO — Backup DB (P0)
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/db/backup_db.sh
# Output:
#   baselines/database/TSBIO_DB_BACKUP_YYYY_MM_DD_HHMM.sql.gz

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/baselines/database"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required (Supabase Postgres connection string)." >&2
  exit 1
fi

TS="$(date +"%Y_%m_%d_%H%M")"
OUT="$OUT_DIR/TSBIO_DB_BACKUP_${TS}.sql.gz"

echo "[backup_db] Writing: $OUT"

# Use pg_dump. If you use Supabase, prefer the direct Postgres connection string.
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$OUT"

echo "[backup_db] Done."
