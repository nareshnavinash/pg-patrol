#!/usr/bin/env bash
#
# Convert Playwright demo recordings (.webm) to a single polished .mp4
#
# Usage: bash scripts/demo-to-mp4.sh
#
# Requires: ffmpeg (brew install ffmpeg)

set -euo pipefail

INPUT_DIR="demo-output"
OUTPUT_FILE="store-assets/pg-patrol-demo.mp4"
TEMP_DIR="demo-output/temp"

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
  echo "Error: ffmpeg is not installed. Run: brew install ffmpeg"
  exit 1
fi

# Check for input files
WEBM_FILES=$(find "$INPUT_DIR" -maxdepth 1 -name "*.webm" -type f | sort)
if [ -z "$WEBM_FILES" ]; then
  echo "Error: No .webm files found in $INPUT_DIR/"
  echo "Run 'npx tsx scripts/record-demo.ts' first."
  exit 1
fi

mkdir -p "$TEMP_DIR"

echo "Found recordings:"
echo "$WEBM_FILES"
echo ""

# Step 1: Convert each .webm to .mp4 with consistent encoding
INDEX=0
CONCAT_FILE="$TEMP_DIR/concat.txt"
> "$CONCAT_FILE"

for f in $WEBM_FILES; do
  BASENAME=$(basename "$f" .webm)
  OUT="$TEMP_DIR/${INDEX}_${BASENAME}.mp4"
  echo "Converting: $f -> $OUT"

  ffmpeg -y -i "$f" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black,fps=30" \
    -c:v libx264 -preset fast -crf 23 \
    -an \
    "$OUT" 2>/dev/null

  echo "file '${INDEX}_${BASENAME}.mp4'" >> "$CONCAT_FILE"
  INDEX=$((INDEX + 1))
done

echo ""

# Step 2: Concatenate all clips
MERGED="$TEMP_DIR/merged.mp4"
echo "Concatenating ${INDEX} clips..."
ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" \
  -c copy \
  "$MERGED" 2>/dev/null

# Step 3: Add fade-in and fade-out
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MERGED" | cut -d. -f1)
FADE_OUT_START=$((DURATION - 2))

echo "Adding fade effects (duration: ${DURATION}s)..."
ffmpeg -y -i "$MERGED" \
  -vf "fade=t=in:st=0:d=1,fade=t=out:st=${FADE_OUT_START}:d=2" \
  -c:v libx264 -preset fast -crf 21 \
  -an \
  "$OUTPUT_FILE" 2>/dev/null

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "Demo video created: $OUTPUT_FILE"
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "File size: $SIZE"
echo ""
echo "Done!"
