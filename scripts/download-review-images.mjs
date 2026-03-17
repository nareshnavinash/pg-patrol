#!/usr/bin/env node
/**
 * Downloads ~60 stock photos from Pexels CDN for review.
 * Themes: cute animals, mouth-watering food, dynamic sports.
 * No API key needed — publicly accessible CDN URLs.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEW_DIR = join(__dirname, 'review-images');

// [pexels-photo-id, slug, bucket, filename]
const IMAGES = [
  // ======== LANDSCAPE (20) ========

  // Cute animals — landscape
  ['1170986', 'pexels-photo-1170986', 'landscape', 'corgi-smile'],
  ['2253275', 'pexels-photo-2253275', 'landscape', 'golden-retriever-field'],
  ['1490908', 'pexels-photo-1490908', 'landscape', 'cat-on-fence'],
  ['406014', 'pexels-photo-406014', 'landscape', 'dog-on-beach'],
  ['1587300', 'pexels-photo-1587300', 'landscape', 'penguins-group'],
  ['792381', 'pexels-photo-792381', 'landscape', 'bunny-rabbit'],
  ['86596', 'pexels-photo-86596', 'landscape', 'fox-wildlife'],

  // Mouth-watering food — landscape
  ['1279330', 'pexels-photo-1279330', 'landscape', 'pizza-fresh'],
  ['70497', 'pexels-photo-70497', 'landscape', 'burger-fries'],
  ['1099680', 'pexels-photo-1099680', 'landscape', 'fruit-platter'],
  ['1092730', 'pexels-photo-1092730', 'landscape', 'sushi-plate'],
  ['357573', 'pexels-photo-357573', 'landscape', 'macarons-colorful'],
  ['1211887', 'pexels-photo-1211887', 'landscape', 'tacos-spread'],

  // Dynamic sports — landscape
  ['46798', 'pexels-photo-46798', 'landscape', 'basketball-dunk'],
  ['209977', 'pexels-photo-209977', 'landscape', 'swimming-pool'],
  ['248547', 'pexels-photo-248547', 'landscape', 'soccer-stadium'],
  ['863988', 'pexels-photo-863988', 'landscape', 'skateboard-trick'],
  ['1432039', 'pexels-photo-1432039', 'landscape', 'surfing-wave'],
  ['2834917', 'pexels-photo-2834917', 'landscape', 'cycling-road'],
  ['3621104', 'pexels-photo-3621104', 'landscape', 'tennis-court'],

  // ======== PORTRAIT (20) ========

  // Cute animals — portrait
  ['1404819', 'pexels-photo-1404819', 'portrait', 'pug-blanket'],
  ['2023384', 'pexels-photo-2023384', 'portrait', 'cat-eyes-closeup'],
  ['1108099', 'pexels-photo-1108099', 'portrait', 'golden-retriever-portrait'],
  ['45201', 'pexels-photo-45201', 'portrait', 'kitten-playful'],
  ['1851164', 'pexels-photo-1851164', 'portrait', 'parrot-colorful'],
  ['247502', 'pexels-photo-247502', 'portrait', 'deer-forest'],
  ['1661535', 'pexels-photo-1661535', 'portrait', 'owl-stare'],

  // Mouth-watering food — portrait
  ['1640777', 'pexels-photo-1640777', 'portrait', 'salad-bowl-fresh'],
  ['376464', 'pexels-photo-376464', 'portrait', 'waffles-berries'],
  ['1565982', 'pexels-photo-1565982', 'portrait', 'coffee-latte-art'],
  ['291528', 'pexels-photo-291528', 'portrait', 'chocolate-cake'],
  ['1640774', 'pexels-photo-1640774', 'portrait', 'avocado-toast'],
  ['1126359', 'pexels-photo-1126359', 'portrait', 'ice-cream-cone'],
  ['1438672', 'pexels-photo-1438672', 'portrait', 'ramen-noodles'],

  // Dynamic sports — portrait
  ['3764011', 'pexels-photo-3764011', 'portrait', 'rock-climbing'],
  ['3621168', 'pexels-photo-3621168', 'portrait', 'runner-track'],
  ['3628100', 'pexels-photo-3628100', 'portrait', 'yoga-pose'],
  ['1552242', 'pexels-photo-1552242', 'portrait', 'snowboard-jump'],
  ['3253501', 'pexels-photo-3253501', 'portrait', 'boxing-gloves'],
  ['1865506', 'pexels-photo-1865506', 'portrait', 'bike-mountain'],

  // ======== SQUARE (20) ========

  // Cute animals — square
  ['160722', 'cat-tiger-getiegert-feel-at-home-160722', 'square', 'tabby-cat-cozy'],
  ['45170', 'kittens-cat-cat-puppy-rush-45170', 'square', 'kittens-playing'],
  ['47547', 'squirrel-animal-cute-rodents-47547', 'square', 'squirrel-acorn'],
  ['33287', 'pexels-photo-33287', 'square', 'puppy-eyes'],
  ['1440387', 'pexels-photo-1440387', 'square', 'panda-eating'],
  ['3608263', 'pexels-photo-3608263', 'square', 'hedgehog-cute'],
  ['1076758', 'pexels-photo-1076758', 'square', 'duckling-pond'],

  // Mouth-watering food — square
  ['958545', 'pexels-photo-958545', 'square', 'pasta-tomato'],
  ['1099680', 'pexels-photo-1099680', 'square', 'fruit-basket-square'],
  ['699953', 'pexels-photo-699953', 'square', 'donuts-glazed'],
  ['1279330', 'pexels-photo-1279330', 'square', 'pizza-slice-square'],
  ['2097090', 'pexels-photo-2097090', 'square', 'pancakes-stack'],
  ['1099683', 'pexels-photo-1099683', 'square', 'smoothie-bowl'],

  // Dynamic sports — square
  ['46798', 'pexels-photo-46798', 'square', 'basketball-action-sq'],
  ['114296', 'pexels-photo-114296', 'square', 'soccer-ball'],
  ['260024', 'pexels-photo-260024', 'square', 'tennis-racket'],
  ['209977', 'pexels-photo-209977', 'square', 'swimming-action-sq'],
  ['1618269', 'pexels-photo-1618269', 'square', 'volleyball-beach'],
  ['863988', 'pexels-photo-863988', 'square', 'skateboard-trick-sq'],
  ['1432039', 'pexels-photo-1432039', 'square', 'surfing-action-sq'],
];

const SIZE_PARAMS = {
  landscape: 'w=400',
  portrait: 'w=400&h=600&fit=crop',
  square: 'w=400&h=400&fit=crop',
};

async function downloadImage(id, slug, bucket, description) {
  const sizeParam = SIZE_PARAMS[bucket];
  const url = `https://images.pexels.com/photos/${id}/${slug}.jpeg?auto=compress&cs=tinysrgb&${sizeParam}`;

  const dir = join(REVIEW_DIR, bucket);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const jpegPath = join(dir, `${description}.jpeg`);
  const webpPath = join(dir, `${description}.webp`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      console.error(`  ✗ ${bucket}/${description} — HTTP ${res.status}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(jpegPath, buffer);

    // Convert to WebP using cwebp
    try {
      execSync(`cwebp -q 80 -quiet "${jpegPath}" -o "${webpPath}"`, { stdio: 'pipe' });
      execSync(`rm "${jpegPath}"`, { stdio: 'pipe' });
    } catch {
      console.warn(`  ⚠ ${bucket}/${description} — WebP conversion failed, keeping JPEG`);
    }

    const finalPath = existsSync(webpPath) ? webpPath : jpegPath;
    const stat = execSync(`stat -f%z "${finalPath}"`, { encoding: 'utf-8' }).trim();
    console.log(`  ✓ ${bucket}/${description} (${(Number(stat) / 1024).toFixed(1)}KB)`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${bucket}/${description} — ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Downloading ${IMAGES.length} images to ${REVIEW_DIR}/\n`);
  console.log('Themes: 🐾 Cute animals | 🍕 Food | 🏀 Sports\n');

  if (!existsSync(REVIEW_DIR)) mkdirSync(REVIEW_DIR, { recursive: true });

  let success = 0;
  let fail = 0;

  for (let i = 0; i < IMAGES.length; i += 5) {
    const batch = IMAGES.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(([id, slug, bucket, desc]) => downloadImage(id, slug, bucket, desc)),
    );
    success += results.filter(Boolean).length;
    fail += results.filter((r) => !r).length;

    if (i + 5 < IMAGES.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone: ${success} downloaded, ${fail} failed`);
  console.log(`\nReview images: open scripts/review-images/`);
}

main().catch(console.error);
