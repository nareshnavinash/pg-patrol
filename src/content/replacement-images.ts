/**
 * Replacement image selection module.
 *
 * Provides pleasant stock photos to replace blocked NSFW images.
 * Uses a 3-tier fallback system:
 *   Tier 1: Cached data URIs from IndexedDB (pre-loaded from background)
 *   Tier 2: Bundled fallback images (always available offline)
 *   Tier 3: SVG banner (last resort, existing createBannerDataUri)
 */

import type { AspectBucket } from '../assets/replacements/manifest';
import { FALLBACK_IMAGES } from '../assets/replacements/manifest';
import { createBannerDataUri } from './banner-data-uri';
import { MessageType } from '../shared/types';

// Pre-loaded cache from background service worker
let cachedReplacements: Record<AspectBucket, string[]> = {
  landscape: [],
  portrait: [],
  square: [],
};

let initRequested = false;

/**
 * Neutral alt text descriptions for Tier 1 (cached data URIs).
 * Never mentions "blocked", "restricted", "nsfw", or "hidden".
 * Bundled Tier 2 images use their own alt text from the manifest.
 */
const ALT_TEXTS: Record<AspectBucket, string[]> = {
  landscape: [
    'Happy corgi smiling',
    'Golden retriever in a field',
    'Cat sitting on a fence',
    'Dog running on the beach',
    'Fluffy bunny rabbit',
    'Adorable red panda',
    'Pink flamingos at a lake',
    'Seal resting on the beach',
    'Otter swimming in water',
    'Baby elephant walking',
    'Dolphins jumping in the ocean',
    'Fresh hot pizza',
    'Juicy burger with fries',
    'Colorful fruit platter',
    'Sushi platter assortment',
    'Colorful French macarons',
    'Delicious taco spread',
    'Breakfast spread on a table',
    'Smoky BBQ ribs',
    'Row of frosted cupcakes',
  ],
  portrait: [
    'Pug wrapped in a blanket',
    'Cat with bright eyes',
    'Golden retriever portrait',
    'Colorful parrot perched',
    'Deer in a forest',
    'Owl with a piercing gaze',
    'Cat sleeping peacefully',
    'Fluffy hamster',
    'Corgi looking at camera',
    'Panda munching bamboo',
    'Cute hedgehog closeup',
    'Fresh salad bowl',
    'Waffles topped with berries',
    'Latte with beautiful art',
    'Rich chocolate cake',
    'Ice cream cone scoops',
    'Stack of fudgy brownies',
    'Plate of spaghetti',
    'Creamy cheesecake slice',
    'Steaming bowl of ramen',
  ],
  square: [
    'Cozy tabby cat',
    'Kittens playing together',
    'Squirrel holding an acorn',
    'Golden puppy face',
    'Panda eating bamboo',
    'Cute little hedgehog',
    'Duckling by a pond',
    'Adorable corgi',
    'Cozy pug snuggling',
    'Cat with big eyes',
    'Bright parrot closeup',
    'Deer in the wild',
    'Pasta with tomato sauce',
    'Glazed donuts',
    'Cheesy pizza slice',
    'Fluffy pancake stack',
    'Fresh fruit basket',
    'Berry smoothie bowl',
    'Decadent chocolate cake',
    'Bowl of ramen noodles',
  ],
};

/**
 * Detect aspect ratio bucket from image dimensions.
 */
export function detectBucket(width: number, height: number): AspectBucket {
  if (width <= 0 || height <= 0) return 'square';
  const ratio = width / height;
  if (ratio >= 1.3) return 'landscape';
  if (ratio <= 0.77) return 'portrait';
  return 'square';
}

/**
 * Simple deterministic hash for consistent image selection.
 * Same URL always gets the same replacement image.
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Request replacement image batch from background service worker.
 * Called once on content script initialization.
 */
export function initReplacementImages(): void {
  if (initRequested) return;
  initRequested = true;

  try {
    chrome.runtime.sendMessage(
      { type: MessageType.GET_REPLACEMENT_BATCH },
      (response: Record<AspectBucket, string[]> | undefined) => {
        if (chrome.runtime.lastError) return;
        if (response) {
          cachedReplacements = response;
        }
      },
    );
  } catch {
    // chrome.runtime may be unavailable in tests
  }
}

/**
 * Get a replacement image src and alt text for a blocked image.
 * Uses 3-tier fallback:
 *   1. Cached data URI from IndexedDB (best: pre-loaded, instant)
 *   2. Bundled fallback via chrome.runtime.getURL (always available)
 *   3. SVG banner data URI (last resort)
 *
 * Always returns a value — never null.
 */
export function getReplacementSrc(
  originalUrl: string,
  width: number,
  height: number,
): { src: string; alt: string } {
  const bucket = detectBucket(width, height);
  const hash = simpleHash(originalUrl);

  // Tier 1: Cached data URI
  const cached = cachedReplacements[bucket];
  if (cached.length > 0) {
    const index = hash % cached.length;
    const altOptions = ALT_TEXTS[bucket];
    const alt = altOptions[index % altOptions.length];
    return { src: cached[index], alt };
  }

  // Tier 2: Bundled fallback
  const fallbacks = FALLBACK_IMAGES[bucket];
  if (fallbacks.length > 0) {
    const index = hash % fallbacks.length;
    const fallback = fallbacks[index];
    try {
      const src = chrome.runtime.getURL(fallback.path);
      return { src, alt: fallback.alt };
    } catch {
      // chrome.runtime may not be available
    }
  }

  // Tier 3: SVG banner (last resort)
  return { src: createBannerDataUri(), alt: 'Decorative image' };
}

/**
 * Inject cached replacements directly (for testing or when background
 * message passing is unavailable).
 */
export function setCachedReplacements(data: Record<AspectBucket, string[]>): void {
  cachedReplacements = data;
}
