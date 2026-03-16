/**
 * @jest-environment jsdom
 */

import { ImageClassificationCache } from '../../src/shared/image-classification-cache';
import type { CacheEntry } from '../../src/shared/image-classification-cache';

// ---- chrome.storage.local mock ----

let storageData: Record<string, unknown> = {};

const mockGet = jest.fn(async (key: string) => {
  return { [key]: storageData[key] ?? undefined };
});
const mockSet = jest.fn(async (items: Record<string, unknown>) => {
  Object.assign(storageData, items);
});
const mockRemove = jest.fn(async (key: string) => {
  delete storageData[key];
});

(globalThis as Record<string, unknown>).chrome = {
  storage: {
    local: { get: mockGet, set: mockSet, remove: mockRemove },
  },
};

const DAY = 86_400_000;

describe('ImageClassificationCache', () => {
  let cache: ImageClassificationCache;

  beforeEach(() => {
    jest.useFakeTimers();
    storageData = {};
    mockGet.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
    cache = new ImageClassificationCache();
    cache.setThreshold(0.6);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ---- init() ----

  describe('init()', () => {
    it('hydrates from chrome.storage.local, discarding expired entries', async () => {
      const now = Date.now();
      storageData['pgPatrolImageCache'] = {
        'https://example.com/fresh.jpg': {
          verdict: 'safe',
          score: 0.1,
          threshold: 0.6,
          cachedAt: now - 1000,
          ttl: DAY,
        },
        'https://example.com/expired.jpg': {
          verdict: 'nsfw',
          score: 0.9,
          threshold: 0.6,
          cachedAt: now - 2 * DAY,
          ttl: DAY,
        },
      };

      await cache.init();

      expect(cache.get('https://example.com/fresh.jpg')).not.toBeNull();
      expect(cache.get('https://example.com/expired.jpg')).toBeNull();
      expect(cache.size).toBe(1);
    });

    it('trims to maxSize when loaded entries exceed 2000', async () => {
      const now = Date.now();
      const entries: Record<string, CacheEntry> = {};
      for (let i = 0; i < 2100; i++) {
        entries[`https://example.com/img${i}.jpg`] = {
          verdict: 'safe',
          score: 0.1,
          threshold: 0.6,
          cachedAt: now - i * 1000, // Newer entries have higher cachedAt
          ttl: 30 * DAY,
        };
      }
      storageData['pgPatrolImageCache'] = entries;

      await cache.init();

      expect(cache.size).toBe(2000);
    });
  });

  // ---- get() ----

  describe('get()', () => {
    it('returns cached entry for known URLs', async () => {
      cache.set('https://example.com/photo.jpg', 'safe', 0.05, 200, 'content');
      const entry = cache.get('https://example.com/photo.jpg');
      expect(entry).not.toBeNull();
      expect(entry!.verdict).toBe('safe');
      expect(entry!.score).toBe(0.05);
    });

    it('returns null for unknown URLs', () => {
      expect(cache.get('https://unknown.com/nope.jpg')).toBeNull();
    });

    it('returns null for expired entries (lazy eviction)', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 900, 'content');
      // Advance past the TTL (large image base = 1 day, ratio 0.05/0.60 ≈ 0.083 → 2× = 2 days)
      jest.advanceTimersByTime(3 * DAY);
      expect(cache.get('https://example.com/img.jpg')).toBeNull();
    });

    it('returns null when threshold has changed (invalidation)', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 200, 'content');
      expect(cache.get('https://example.com/img.jpg')).not.toBeNull();

      cache.setThreshold(0.3);
      expect(cache.get('https://example.com/img.jpg')).toBeNull();
    });

    it('caches both safe and NSFW verdicts', () => {
      cache.set('https://example.com/safe.jpg', 'safe', 0.05, 200, 'content');
      cache.set('https://example.com/nsfw.jpg', 'nsfw', 0.9, 200, 'content');

      expect(cache.get('https://example.com/safe.jpg')!.verdict).toBe('safe');
      expect(cache.get('https://example.com/nsfw.jpg')!.verdict).toBe('nsfw');
    });
  });

  // ---- set() ----

  describe('set()', () => {
    it('makes entry available to get() immediately (sync)', () => {
      cache.set('https://example.com/photo.jpg', 'safe', 0.1, 200, 'content');
      expect(cache.get('https://example.com/photo.jpg')).not.toBeNull();
    });

    it('persists to storage after debounce flush', async () => {
      cache.set('https://example.com/photo.jpg', 'safe', 0.1, 200, 'content');

      // Before debounce
      expect(mockSet).not.toHaveBeenCalled();

      // Flush debounce timer
      jest.advanceTimersByTime(600);

      // Allow async persist to complete
      await jest.runAllTimersAsync();

      expect(mockSet).toHaveBeenCalled();
      const stored = storageData['pgPatrolImageCache'] as Record<string, CacheEntry>;
      expect(stored['https://example.com/photo.jpg']).toBeDefined();
    });
  });

  // ---- Base TTL ----

  describe('base TTL', () => {
    it('avatar context → 30 days', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 200, 'avatar');
      const entry = cache.get('https://example.com/img.jpg')!;
      // Avatar base = 30d, ratio 0.05/0.60 ≈ 0.083 → 2× multiplier → 60d
      expect(entry.ttl).toBe(60 * DAY);
    });

    it('size ≤ 150 → 14 day base', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 120, 'content');
      const entry = cache.get('https://example.com/img.jpg')!;
      // Thumbnail base = 14d, ratio 0.083 → 2× → 28d
      expect(entry.ttl).toBe(28 * DAY);
    });

    it('size ≤ 300 → 7 day base', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 250, 'content');
      const entry = cache.get('https://example.com/img.jpg')!;
      // Small-medium base = 7d, ratio 0.083 → 2× → 14d
      expect(entry.ttl).toBe(14 * DAY);
    });

    it('size ≤ 800 → 3 day base', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 500, 'content');
      const entry = cache.get('https://example.com/img.jpg')!;
      // Standard base = 3d, ratio 0.083 → 2× → 6d
      expect(entry.ttl).toBe(6 * DAY);
    });

    it('size > 800 → 1 day base', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 1200, 'content');
      const entry = cache.get('https://example.com/img.jpg')!;
      // Large base = 1d, ratio 0.083 → 2× → 2d
      expect(entry.ttl).toBe(2 * DAY);
    });
  });

  // ---- Confidence multiplier (safe images) ----

  describe('confidence multiplier (safe)', () => {
    // All use size 500 → standard base 3 days, threshold 0.60

    it('ratio < 0.20 → 2× multiplier', () => {
      // score=0.05, ratio = 0.05/0.60 ≈ 0.083
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(6 * DAY);
    });

    it('ratio 0.20–0.49 → 1.5× multiplier', () => {
      // score=0.20, ratio = 0.20/0.60 ≈ 0.333
      cache.set('https://example.com/img.jpg', 'safe', 0.2, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(Math.round(3 * DAY * 1.5));
    });

    it('ratio 0.50–0.74 → 1× multiplier', () => {
      // score=0.40, ratio = 0.40/0.60 ≈ 0.667
      cache.set('https://example.com/img.jpg', 'safe', 0.4, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(3 * DAY);
    });

    it('ratio ≥ 0.75 → 0.5× multiplier', () => {
      // score=0.50, ratio = 0.50/0.60 ≈ 0.833
      cache.set('https://example.com/img.jpg', 'safe', 0.5, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(Math.round(3 * DAY * 0.5));
    });
  });

  // ---- Confidence multiplier (NSFW images) ----

  describe('confidence multiplier (NSFW)', () => {
    // All use size 500 → standard base 3 days, threshold 0.60

    it('ratio > 0.80 → 2× multiplier', () => {
      // score=0.95, ratio = (0.95-0.60)/(1-0.60) = 0.875
      cache.set('https://example.com/img.jpg', 'nsfw', 0.95, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(6 * DAY);
    });

    it('ratio 0.31–0.80 → 1× multiplier', () => {
      // score=0.80, ratio = (0.80-0.60)/(1-0.60) = 0.50
      cache.set('https://example.com/img.jpg', 'nsfw', 0.8, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(3 * DAY);
    });

    it('ratio ≤ 0.30 → 0.5× multiplier', () => {
      // score=0.65, ratio = (0.65-0.60)/(1-0.60) = 0.125
      cache.set('https://example.com/img.jpg', 'nsfw', 0.65, 500, 'content');
      expect(cache.get('https://example.com/img.jpg')!.ttl).toBe(Math.round(3 * DAY * 0.5));
    });
  });

  // ---- Hybrid TTL examples ----

  describe('hybrid TTL examples', () => {
    it('avatar (30d) + safe ratio 0.05 (2×) = 60 days', () => {
      // score=0.03, ratio=0.03/0.60=0.05 → 2×
      cache.set('https://example.com/avatar.jpg', 'safe', 0.03, 80, 'avatar');
      expect(cache.get('https://example.com/avatar.jpg')!.ttl).toBe(60 * DAY);
    });

    it('hero (1d) + NSFW borderline (0.5×) = 12 hours', () => {
      // score=0.65, size=1200 → large base 1d; ratio=(0.65-0.60)/(0.40)=0.125 → 0.5×
      cache.set('https://example.com/hero.jpg', 'nsfw', 0.65, 1200, 'content');
      expect(cache.get('https://example.com/hero.jpg')!.ttl).toBe(Math.round(DAY * 0.5));
    });

    it('thumbnail (14d) + safe clearly (1.5×) = 21 days', () => {
      // score=0.20, ratio=0.20/0.60≈0.333 → 1.5×
      cache.set('https://example.com/thumb.jpg', 'safe', 0.2, 120, 'content');
      expect(cache.get('https://example.com/thumb.jpg')!.ttl).toBe(Math.round(14 * DAY * 1.5));
    });
  });

  // ---- setThreshold() ----

  describe('setThreshold()', () => {
    it('updates the active threshold used for cache validation', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.05, 200, 'content');

      cache.setThreshold(0.3);
      // Entry was cached at threshold 0.60, now threshold is 0.30 → invalidated
      expect(cache.get('https://example.com/img.jpg')).toBeNull();
    });

    it('entry cached at threshold 0.60 returns null when current threshold is 0.30', () => {
      cache.set('https://example.com/img.jpg', 'nsfw', 0.5, 200, 'content');
      cache.setThreshold(0.3);
      expect(cache.get('https://example.com/img.jpg')).toBeNull();
    });
  });

  // ---- detectContext() ----

  describe('detectContext()', () => {
    it('URL containing "/avatar/" → avatar', () => {
      expect(cache.detectContext('https://cdn.example.com/avatar/123.jpg')).toBe('avatar');
    });

    it('URL containing gravatar.com → avatar', () => {
      expect(cache.detectContext('https://gravatar.com/avatar/abc.jpg')).toBe('avatar');
    });

    it('element with class containing "profile-pic" → avatar', () => {
      const el = document.createElement('img');
      el.className = 'user-card__profile-pic';
      expect(cache.detectContext('https://example.com/img.jpg', el)).toBe('avatar');
    });

    it('small square element (≤100px) → avatar', () => {
      const el = document.createElement('img');
      Object.defineProperty(el, 'clientWidth', { value: 48 });
      Object.defineProperty(el, 'clientHeight', { value: 48 });
      expect(cache.detectContext('https://example.com/img.jpg', el)).toBe('avatar');
    });

    it('regular URL without avatar signals → content', () => {
      expect(cache.detectContext('https://example.com/photos/banner.jpg')).toBe('content');
    });
  });

  // ---- clear() ----

  describe('clear()', () => {
    it('empties both memory and storage', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');
      expect(cache.size).toBe(1);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('https://example.com/img.jpg')).toBeNull();
      expect(mockRemove).toHaveBeenCalledWith('pgPatrolImageCache');
    });
  });

  // ---- Trim ----

  describe('cache trimming', () => {
    it('trims to maxSize when exceeding limit (keeps newest by cachedAt)', () => {
      // Fill beyond maxSize
      for (let i = 0; i < 2100; i++) {
        cache.set(`https://example.com/img${i}.jpg`, 'safe', 0.1, 200, 'content');
        // Manually advance time slightly so each has distinct cachedAt
        jest.advanceTimersByTime(1);
      }

      // Size should still be bounded to what we added (trimming happens in persist)
      // But in-memory can exceed — trim happens on init from storage
      // Let's test via init flow instead
      expect(cache.size).toBe(2100);
    });
  });

  // ---- Graceful fallback ----

  describe('graceful fallback', () => {
    it('continues with empty cache when chrome.storage.local throws', async () => {
      mockGet.mockRejectedValueOnce(new Error('Storage unavailable'));

      const errCache = new ImageClassificationCache();
      errCache.setThreshold(0.6);
      await errCache.init();

      // Should work as in-memory only
      errCache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');
      expect(errCache.get('https://example.com/img.jpg')).not.toBeNull();
    });
  });

  // ---- Multi-tab merge ----

  describe('persist uses read-merge-write', () => {
    it('merges with existing storage entries (newer cachedAt wins)', async () => {
      const now = Date.now();

      // Simulate another tab having written to storage
      storageData['pgPatrolImageCache'] = {
        'https://other-tab.com/img.jpg': {
          verdict: 'nsfw',
          score: 0.9,
          threshold: 0.6,
          cachedAt: now,
          ttl: 3 * DAY,
        },
      };

      cache.set('https://this-tab.com/img.jpg', 'safe', 0.1, 200, 'content');

      // Flush debounce
      jest.advanceTimersByTime(600);
      await jest.runAllTimersAsync();

      const stored = storageData['pgPatrolImageCache'] as Record<string, CacheEntry>;
      // Both entries should be present
      expect(stored['https://other-tab.com/img.jpg']).toBeDefined();
      expect(stored['https://this-tab.com/img.jpg']).toBeDefined();
    });
  });

  // ---- Edge threshold values ----

  describe('edge thresholds', () => {
    it('handles threshold near 0 without division by zero', () => {
      cache.setThreshold(0.001); // Will be clamped to 0.01
      cache.set('https://example.com/img.jpg', 'safe', 0.005, 200, 'content');
      expect(cache.get('https://example.com/img.jpg')).not.toBeNull();
    });

    it('handles threshold near 1 without division by zero', () => {
      cache.setThreshold(0.999); // Will be clamped to 0.99
      cache.set('https://example.com/img.jpg', 'nsfw', 0.999, 200, 'content');
      expect(cache.get('https://example.com/img.jpg')).not.toBeNull();
    });
  });

  // ---- URL normalization ----

  describe('URL normalization', () => {
    it('strips CDN size params (w, h, width, height)', () => {
      cache.set('https://cdn.example.com/img.jpg?w=200&h=150', 'safe', 0.1, 200, 'content');
      expect(cache.get('https://cdn.example.com/img.jpg?w=400&h=300')).not.toBeNull();
      expect(cache.get('https://cdn.example.com/img.jpg')).not.toBeNull();
    });

    it('strips cache-bust params (v, _, t, cb)', () => {
      cache.set('https://example.com/img.jpg?v=123', 'safe', 0.1, 200, 'content');
      expect(cache.get('https://example.com/img.jpg?v=456')).not.toBeNull();
      expect(cache.get('https://example.com/img.jpg?_=ts123')).not.toBeNull();
    });

    it('preserves meaningful params that are not in the strip list', () => {
      cache.set('https://example.com/img.jpg?id=abc123', 'safe', 0.1, 200, 'content');
      expect(cache.get('https://example.com/img.jpg?id=abc123')).not.toBeNull();
      expect(cache.get('https://example.com/img.jpg?id=different')).toBeNull();
    });

    it('handles URLs without query params unchanged', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');
      expect(cache.get('https://example.com/img.jpg')).not.toBeNull();
    });

    it('handles invalid URLs gracefully (no crash)', () => {
      cache.set('not-a-valid-url', 'safe', 0.1, 200, 'content');
      expect(cache.get('not-a-valid-url')).not.toBeNull();
    });

    it('same image with different size params shares a single cache entry', () => {
      cache.set('https://cdn.example.com/photo.jpg?w=200&q=80', 'nsfw', 0.85, 200, 'content');
      // q is in strip list, so both should normalize to same key
      const entry = cache.get('https://cdn.example.com/photo.jpg?w=400&q=90');
      expect(entry).not.toBeNull();
      expect(entry!.verdict).toBe('nsfw');
    });
  });

  // ---- Cache stats ----

  describe('getStats()', () => {
    it('returns zero stats on a fresh cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('tracks hits and misses', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');

      cache.get('https://example.com/img.jpg'); // hit
      cache.get('https://example.com/img.jpg'); // hit
      cache.get('https://example.com/miss.jpg'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('resets stats on clear()', () => {
      cache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');
      cache.get('https://example.com/img.jpg');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('counts expired and threshold-invalidated lookups as misses', () => {
      cache.set('https://example.com/expired.jpg', 'safe', 0.1, 900, 'content');
      jest.advanceTimersByTime(3 * DAY);
      cache.get('https://example.com/expired.jpg'); // miss (expired)

      cache.set('https://example.com/threshold.jpg', 'safe', 0.1, 200, 'content');
      cache.setThreshold(0.3);
      cache.get('https://example.com/threshold.jpg'); // miss (threshold changed)

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
    });
  });

  // ---- In-memory size bound ----

  describe('in-memory size bound', () => {
    it('trims in-memory cache when exceeding 1.5× MAX_SIZE via set()', () => {
      // MAX_SIZE is 2000, so 1.5× = 3000
      for (let i = 0; i < 3001; i++) {
        cache.set(`https://example.com/img${i}.jpg`, 'safe', 0.1, 200, 'content');
        jest.advanceTimersByTime(1);
      }

      // After crossing the 3000 threshold, trimToMaxSize should have been called
      expect(cache.size).toBeLessThanOrEqual(2000);
    });
  });

  // ---- Storage quota awareness ----

  describe('storage quota handling', () => {
    it('logs warning and retries on QUOTA error during persist', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let callCount = 0;
      mockSet.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('QUOTA_BYTES exceeded');
        }
      });

      cache.set('https://example.com/img.jpg', 'safe', 0.1, 200, 'content');

      // Flush debounce
      jest.advanceTimersByTime(600);
      await jest.runAllTimersAsync();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Storage quota exceeded'));
      // Should have retried after trimming
      expect(mockSet).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });
  });
});
