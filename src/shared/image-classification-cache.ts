/**
 * Persistent image classification cache.
 *
 * Stores both safe and NSFW verdicts keyed by image URL, backed by
 * chrome.storage.local so results survive across navigations and
 * browser restarts. The hot-path methods (get/set) are synchronous —
 * persistence is debounced and batched.
 */

export type CacheVerdict = 'safe' | 'nsfw';

export interface CacheEntry {
  verdict: CacheVerdict;
  /** NSFW score at classification time */
  score: number;
  /** Threshold that was active when this entry was cached */
  threshold: number;
  /** Date.now() timestamp when cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttl: number;
}

const STORAGE_KEY = 'pgPatrolImageCache';
const MAX_SIZE = 2000;
const PERSIST_DEBOUNCE_MS = 500;

// Query params that are safe to strip for cache normalization
const STRIP_PARAMS = new Set([
  'w',
  'h',
  'width',
  'height',
  'size',
  'v',
  '_',
  't',
  'cb',
  'quality',
  'q',
  'auto',
  'format',
  'fit',
  'dpr',
]);

/**
 * Normalize a URL by stripping CDN size/cache-bust query params.
 * This prevents duplicate cache entries for the same image at different sizes.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.search) return url;

    let changed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      if (STRIP_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }

    if (!changed) return url;

    // Remove trailing '?' when all params were stripped
    const result = parsed.toString();
    return result.endsWith('?') ? result.slice(0, -1) : result;
  } catch {
    return url;
  }
}

// Base TTL constants (milliseconds)
const DAY = 86_400_000;
const TTL_AVATAR = 30 * DAY;
const TTL_THUMBNAIL = 14 * DAY;
const TTL_SMALL_MEDIUM = 7 * DAY;
const TTL_STANDARD = 3 * DAY;
const TTL_LARGE = 1 * DAY;

// Avatar detection patterns
const AVATAR_URL_PATTERNS = [
  '/avatar/',
  '/avatars/',
  '/profile/',
  '/profile-pic/',
  '/icon/',
  '/favicon',
  '/user-photo/',
  '/pfp/',
  'gravatar.com',
];
const AVATAR_CLASS_PATTERNS = [
  'avatar',
  'profile-pic',
  'profile-img',
  'user-photo',
  'user-image',
  'pfp',
  'icon',
];

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class ImageClassificationCache {
  private cache = new Map<string, CacheEntry>();
  private currentThreshold = 0.6;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private hits = 0;
  private misses = 0;

  /** Hydrate from chrome.storage.local, discarding expired entries. */
  async init(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const raw: Record<string, CacheEntry> = data[STORAGE_KEY] ?? {};
      const now = Date.now();

      for (const [url, entry] of Object.entries(raw)) {
        if (now < entry.cachedAt + entry.ttl) {
          this.cache.set(url, entry);
        }
      }

      // Trim if we loaded more than maxSize
      if (this.cache.size > MAX_SIZE) {
        this.trimToMaxSize();
      }

      // Persist cleaned-up cache back
      this.dirty = true;
      this.schedulePersist();
    } catch {
      // Storage unavailable — continue with empty in-memory cache
    }
  }

  /** Set the active threshold (called on init and when user changes sensitivity). */
  setThreshold(threshold: number): void {
    this.currentThreshold = threshold;
  }

  /**
   * Synchronous lookup — hot path, no async.
   * Returns null if entry is missing, expired, or threshold has changed.
   */
  get(url: string): CacheEntry | null {
    const normalized = normalizeUrl(url);
    const entry = this.cache.get(normalized);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Expired?
    if (Date.now() >= entry.cachedAt + entry.ttl) {
      this.cache.delete(normalized);
      this.misses++;
      return null;
    }

    // Threshold changed since caching? Verdict may be wrong — re-classify.
    if (entry.threshold !== this.currentThreshold) {
      this.cache.delete(normalized);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry;
  }

  /**
   * Synchronous write — stores entry and schedules debounced persist.
   */
  set(
    url: string,
    verdict: CacheVerdict,
    score: number,
    imageSize: number,
    imageContext: string,
  ): void {
    const normalized = normalizeUrl(url);
    const base = this.baseTtl(imageSize, imageContext);
    const multiplier = this.confidenceMultiplier(score, verdict, this.currentThreshold);
    const ttl = Math.round(base * multiplier);

    const entry: CacheEntry = {
      verdict,
      score,
      threshold: this.currentThreshold,
      cachedAt: Date.now(),
      ttl,
    };

    this.cache.set(normalized, entry);

    // Inline trim if in-memory Map grows well past MAX_SIZE
    if (this.cache.size > MAX_SIZE * 1.5) {
      this.trimToMaxSize();
    }

    this.dirty = true;
    this.schedulePersist();
  }

  /**
   * Detect image context from URL and optional DOM element.
   * Returns 'avatar' or 'content'.
   */
  detectContext(url: string, element?: HTMLElement): string {
    // Check URL patterns
    const lowerUrl = url.toLowerCase();
    for (const pattern of AVATAR_URL_PATTERNS) {
      if (lowerUrl.includes(pattern)) return 'avatar';
    }

    // Check element class/id
    if (element) {
      const classAndId = `${element.className} ${element.id}`.toLowerCase();
      for (const pattern of AVATAR_CLASS_PATTERNS) {
        if (classAndId.includes(pattern)) return 'avatar';
      }

      // Square images ≤ 100px are strong avatar signals
      const w = element.clientWidth;
      const h = element.clientHeight;
      if (w > 0 && h > 0 && w <= 100 && h <= 100 && Math.abs(w - h) <= 10) {
        return 'avatar';
      }
    }

    return 'content';
  }

  /** Return cache performance stats (useful for developer mode). */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /** Clear both in-memory and storage caches. */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.dirty = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      chrome.storage.local.remove(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  get size(): number {
    return this.cache.size;
  }

  // ---- Private helpers ----

  private baseTtl(imageSize: number, imageContext: string): number {
    if (imageContext === 'avatar') return TTL_AVATAR;
    if (imageSize <= 150) return TTL_THUMBNAIL;
    if (imageSize <= 300) return TTL_SMALL_MEDIUM;
    if (imageSize <= 800) return TTL_STANDARD;
    return TTL_LARGE;
  }

  private confidenceMultiplier(score: number, verdict: CacheVerdict, threshold: number): number {
    // Clamp threshold to avoid division by zero
    const t = Math.max(0.01, Math.min(0.99, threshold));

    if (verdict === 'safe') {
      const ratio = score / t;
      if (ratio < 0.2) return 2;
      if (ratio < 0.5) return 1.5;
      if (ratio < 0.75) return 1;
      return 0.5;
    }

    // NSFW
    const ratio = (score - t) / (1 - t);
    if (ratio > 0.8) return 2;
    if (ratio > 0.3) return 1;
    return 0.5;
  }

  private trimToMaxSize(): void {
    if (this.cache.size <= MAX_SIZE) return;

    // Sort by cachedAt descending, keep newest
    const sorted = [...this.cache.entries()].sort((a, b) => b[1].cachedAt - a[1].cachedAt);
    this.cache.clear();
    for (let i = 0; i < MAX_SIZE && i < sorted.length; i++) {
      this.cache.set(sorted[i][0], sorted[i][1]);
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistToStorage();
    }, PERSIST_DEBOUNCE_MS);
  }

  /**
   * Read-merge-write to handle multi-tab races.
   * Newer cachedAt wins for each URL.
   */
  private async persistToStorage(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;

    try {
      // Read current storage state (may have entries from other tabs)
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored: Record<string, CacheEntry> = data[STORAGE_KEY] ?? {};
      const now = Date.now();

      // Merge: start from stored, overlay in-memory entries (newer wins)
      const merged: Record<string, CacheEntry> = {};

      // Add stored entries that are not expired
      for (const [url, entry] of Object.entries(stored)) {
        if (now < entry.cachedAt + entry.ttl) {
          merged[url] = entry;
        }
      }

      // Overlay in-memory entries (newer cachedAt wins)
      for (const [url, entry] of this.cache) {
        if (now >= entry.cachedAt + entry.ttl) continue; // skip expired
        const existing = merged[url];
        if (!existing || entry.cachedAt >= existing.cachedAt) {
          merged[url] = entry;
        }
      }

      // Trim to maxSize if needed (keep newest by cachedAt)
      const urls = Object.keys(merged);
      if (urls.length > MAX_SIZE) {
        urls.sort((a, b) => merged[b].cachedAt - merged[a].cachedAt);
        for (let i = MAX_SIZE; i < urls.length; i++) {
          delete merged[urls[i]];
        }
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: merged });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('QUOTA') || message.includes('quota')) {
        console.warn(
          `[PG Patrol] Storage quota exceeded (${this.cache.size} in-memory entries). ` +
            'Trimming cache and retrying.',
        );
        // Aggressively trim and retry once
        this.trimToMaxSize();
        try {
          const trimmed: Record<string, CacheEntry> = {};
          for (const [url, entry] of this.cache) {
            trimmed[url] = entry;
          }
          await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
        } catch {
          // Give up — continue in-memory only
        }
      }
      // Other storage errors — in-memory only
    }
  }
}

/** Singleton cache instance used throughout the extension. */
export const imageCache = new ImageClassificationCache();
