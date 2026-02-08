#!/usr/bin/env bash
set -euo pipefail

# TSBIO — Zip source baseline (P0)
# Usage:
#   ./scripts/zip_source_baseline.sh v3
# Output:
#   baselines/source/TSBIO_SRC_YYYYMMDD_vX.zip

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/baselines/source"
mkdir -p "$OUT_DIR"

VER="${1:-vX}"
DATE_="$(date +"%Y%m%d")"
OUT="$OUT_DIR/TSBIO_SRC_${DATE_}_${VER}.zip"

echo "[zip_source_baseline] Writing: $OUT"

# Exclude node_modules, .next, and already-produced baseline zips.
cd "$ROOT_DIR"
zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "baselines/source/*.zip" \
  -x ".git/*" \
  -x "*.log"

echo "[zip_source_baseline] Done."
