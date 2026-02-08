#!/usr/bin/env bash
set -euo pipefail

# TSBIO — Snapshot schema (P0)
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/db/snapshot_schema.sh
# Output:
#   baselines/database/TSBIO_DB_SCHEMA_YYYY_MM_DD_HHMM.sql

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/baselines/database"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required (Supabase Postgres connection string)." >&2
  exit 1
fi

TS="$(date +"%Y_%m_%d_%H%M")"
OUT="$OUT_DIR/TSBIO_DB_SCHEMA_${TS}.sql"

echo "[snapshot_schema] Writing: $OUT"

# schema-only dump
pg_dump --schema-only --no-owner --no-privileges --format=plain "$DATABASE_URL" > "$OUT"

echo "[snapshot_schema] Done."
