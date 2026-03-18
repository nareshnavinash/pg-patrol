#!/bin/bash
# Render PG Patrol launch video and banner
# Run from the remotion/ directory

set -e

echo "=== Rendering launch video (30s, 1080p, MP4) ==="
npx remotion render src/index.ts LaunchVideo out/pg-patrol-launch.mp4 --image-format=png
echo "Done: out/pg-patrol-launch.mp4"

echo ""
echo "=== Rendering banner frames (5s, 800x200, PNG sequence) ==="
mkdir -p out/Banner
npx remotion render src/index.ts Banner --image-format=png --sequence --output-location=out/Banner/
echo "Done: out/Banner/"

echo ""
echo "=== Converting banner to GIF ==="
ffmpeg -y -framerate 20 \
  -i out/Banner/element-%02d.png \
  -vf "fps=20,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 \
  out/pg-patrol-banner.gif
echo "Done: out/pg-patrol-banner.gif"

echo ""
echo "=== Copying to store-assets ==="
cp out/pg-patrol-banner.gif ../store-assets/pg-patrol-banner.gif
cp out/pg-patrol-launch.mp4 ../store-assets/pg-patrol-launch.mp4
echo "Done!"

echo ""
echo "=== Output sizes ==="
ls -lh out/pg-patrol-launch.mp4 out/pg-patrol-banner.gif
