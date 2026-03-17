/**
 * IndexedDB-backed cache for replacement images.
 * Fetches stock photo CDN URLs and stores them as data URIs for instant use
 * by content scripts when replacing blocked NSFW images.
 */

import { REPLACEMENT_URLS } from '../data/replacement-image-urls';
import type { AspectBucket } from '../assets/replacements/manifest';

const DB_NAME = 'pg-patrol-replacements';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const IMAGES_PER_BUCKET = 10;

interface CachedImage {
  bucket: AspectBucket;
  index: number;
  dataUri: string;
  url: string;
  fetchedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['bucket', 'index'] });
        store.createIndex('bucket', 'bucket', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function fetchAsDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Fill the cache with images for all buckets.
 * Fetches ~IMAGES_PER_BUCKET random URLs per bucket.
 */
export async function cacheImages(): Promise<void> {
  const db = await openDb();
  const buckets: AspectBucket[] = ['landscape', 'portrait', 'square'];

  for (const bucket of buckets) {
    const urls = REPLACEMENT_URLS[bucket];
    if (!urls || urls.length === 0) continue;

    const selected = pickRandom(urls, IMAGES_PER_BUCKET);

    for (let i = 0; i < selected.length; i++) {
      try {
        const dataUri = await fetchAsDataUri(selected[i]);
        const entry: CachedImage = {
          bucket,
          index: i,
          dataUri,
          url: selected[i],
          fetchedAt: Date.now(),
        };

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(entry);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Individual fetch failure — skip this image
      }
    }
  }

  db.close();
}

/**
 * Get all cached data URIs for a specific bucket.
 */
export async function getCachedImages(bucket: AspectBucket): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('bucket');
    const request = index.getAll(bucket);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as CachedImage[]).map((r) => r.dataUri));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get cached images for all buckets.
 */
export async function getAllCachedImages(): Promise<Record<AspectBucket, string[]>> {
  const [landscape, portrait, square] = await Promise.all([
    getCachedImages('landscape'),
    getCachedImages('portrait'),
    getCachedImages('square'),
  ]);
  return { landscape, portrait, square };
}

/**
 * Rotate a subset of cached images with fresh ones from the URL list.
 * Replaces ~3 images per bucket to add variety over time.
 */
export async function rotateCachedImages(): Promise<void> {
  const db = await openDb();
  const buckets: AspectBucket[] = ['landscape', 'portrait', 'square'];
  const ROTATE_COUNT = 3;

  for (const bucket of buckets) {
    const urls = REPLACEMENT_URLS[bucket];
    if (!urls || urls.length === 0) continue;

    // Get existing cached URLs to avoid duplicates
    const existingUrls = new Set<string>();
    const existing = await new Promise<CachedImage[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('bucket');
      const request = index.getAll(bucket);
      request.onsuccess = () => resolve(request.result as CachedImage[]);
      request.onerror = () => reject(request.error);
    });

    for (const entry of existing) {
      existingUrls.add(entry.url);
    }

    // Pick fresh URLs not already cached
    const freshUrls = urls.filter((u) => !existingUrls.has(u));
    const toFetch = pickRandom(freshUrls, ROTATE_COUNT);

    // Pick random indices to replace
    const indicesToReplace = pickRandom(
      Array.from({ length: IMAGES_PER_BUCKET }, (_, i) => i),
      ROTATE_COUNT,
    );

    for (let i = 0; i < toFetch.length; i++) {
      try {
        const dataUri = await fetchAsDataUri(toFetch[i]);
        const entry: CachedImage = {
          bucket,
          index: indicesToReplace[i],
          dataUri,
          url: toFetch[i],
          fetchedAt: Date.now(),
        };

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(entry);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Individual fetch failure — skip
      }
    }
  }

  db.close();
}
