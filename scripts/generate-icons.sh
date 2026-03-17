#!/usr/bin/env bash
# Generate PNG icons from the master SVG logo.
# Requires either rsvg-convert (brew install librsvg) or sips (macOS built-in).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SVG="$REPO_ROOT/src/assets/icons/logo.svg"
OUT_DIR="$REPO_ROOT/src/assets/icons"

SIZES=(16 32 48 128 256 512)

if ! [ -f "$SVG" ]; then
  echo "ERROR: $SVG not found" >&2
  exit 1
fi

if command -v rsvg-convert &>/dev/null; then
  echo "Using rsvg-convert..."
  for size in "${SIZES[@]}"; do
    rsvg-convert -w "$size" -h "$size" "$SVG" -o "$OUT_DIR/icon-${size}.png"
    echo "  icon-${size}.png (${size}x${size})"
  done
elif command -v sips &>/dev/null; then
  echo "Using sips (macOS built-in)..."
  # sips cannot read SVG, so we need a temporary PNG via qlmanage
  TMP_PNG="$(mktemp /tmp/pg-patrol-icon-XXXXXX.png)"
  trap 'rm -f "$TMP_PNG"' EXIT
  qlmanage -t -s 512 -o /tmp "$SVG" 2>/dev/null
  QLOUT="/tmp/$(basename "$SVG").png"
  if [ -f "$QLOUT" ]; then
    mv "$QLOUT" "$TMP_PNG"
  else
    echo "ERROR: qlmanage failed to render SVG. Install librsvg: brew install librsvg" >&2
    exit 1
  fi
  for size in "${SIZES[@]}"; do
    sips -z "$size" "$size" "$TMP_PNG" --out "$OUT_DIR/icon-${size}.png" &>/dev/null
    echo "  icon-${size}.png (${size}x${size})"
  done
else
  echo "ERROR: No SVG renderer found." >&2
  echo "  Install librsvg:  brew install librsvg" >&2
  echo "  Or use macOS sips (should be available by default)" >&2
  exit 1
fi

echo ""
echo "Done! Generated ${#SIZES[@]} icons in $OUT_DIR"
