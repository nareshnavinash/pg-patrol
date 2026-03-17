/**
 * @jest-environment jsdom
 */

import {
  detectBucket,
  simpleHash,
  getReplacementSrc,
  setCachedReplacements,
} from '../../src/content/replacement-images';

// Mock banner-data-uri
jest.mock('../../src/content/banner-data-uri', () => ({
  createBannerDataUri: jest
    .fn()
    .mockReturnValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E'),
}));

// Provide chrome.runtime stub
if (!(globalThis as Record<string, unknown>).chrome) {
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      sendMessage: jest.fn(),
      getURL: jest.fn((path: string) => `chrome-extension://fake-id/${path}`),
      lastError: null,
    },
    storage: {
      local: {
        get: jest.fn(async () => ({})),
        set: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
      },
    },
  };
}

describe('replacement-images', () => {
  beforeEach(() => {
    // Reset cached replacements to empty before each test
    setCachedReplacements({ landscape: [], portrait: [], square: [] });
  });

  describe('detectBucket', () => {
    it('returns landscape for wide images (1920x1080)', () => {
      expect(detectBucket(1920, 1080)).toBe('landscape');
    });

    it('returns portrait for tall images (1080x1920)', () => {
      expect(detectBucket(1080, 1920)).toBe('portrait');
    });

    it('returns square for equal dimensions (500x500)', () => {
      expect(detectBucket(500, 500)).toBe('square');
    });

    it('returns square for near-square ratios (600x500)', () => {
      expect(detectBucket(600, 500)).toBe('square');
    });

    it('returns square for zero width', () => {
      expect(detectBucket(0, 100)).toBe('square');
    });

    it('returns square for zero height', () => {
      expect(detectBucket(100, 0)).toBe('square');
    });

    it('returns square for negative dimensions', () => {
      expect(detectBucket(-100, 200)).toBe('square');
    });

    it('landscape threshold: ratio >= 1.3', () => {
      expect(detectBucket(130, 100)).toBe('landscape');
      expect(detectBucket(129, 100)).toBe('square');
    });

    it('portrait threshold: ratio <= 0.77', () => {
      expect(detectBucket(77, 100)).toBe('portrait');
      expect(detectBucket(78, 100)).toBe('square');
    });
  });

  describe('simpleHash', () => {
    it('produces deterministic results', () => {
      const hash1 = simpleHash('https://example.com/image.jpg');
      const hash2 = simpleHash('https://example.com/image.jpg');
      expect(hash1).toBe(hash2);
    });

    it('produces different results for different strings', () => {
      const hash1 = simpleHash('https://example.com/image1.jpg');
      const hash2 = simpleHash('https://example.com/image2.jpg');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a non-negative number', () => {
      expect(simpleHash('test')).toBeGreaterThanOrEqual(0);
      expect(simpleHash('')).toBeGreaterThanOrEqual(0);
      expect(simpleHash('a very long string with many characters')).toBeGreaterThanOrEqual(0);
    });

    it('handles empty string', () => {
      expect(simpleHash('')).toBe(0);
    });
  });

  describe('getReplacementSrc', () => {
    it('returns cached data URI when available (Tier 1)', () => {
      setCachedReplacements({
        landscape: ['data:image/jpeg;base64,landscape1', 'data:image/jpeg;base64,landscape2'],
        portrait: ['data:image/jpeg;base64,portrait1'],
        square: ['data:image/jpeg;base64,square1'],
      });

      const result = getReplacementSrc('https://example.com/wide.jpg', 1920, 1080);
      expect(result.src).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.alt).toBeTruthy();
    });

    it('falls back to bundled images when no cache (Tier 2)', () => {
      setCachedReplacements({ landscape: [], portrait: [], square: [] });

      const result = getReplacementSrc('https://example.com/test.jpg', 500, 500);
      expect(result.src).toMatch(/^chrome-extension:\/\//);
      expect(result.alt).toBeTruthy();
    });

    it('falls back to SVG banner as last resort (Tier 3)', () => {
      setCachedReplacements({ landscape: [], portrait: [], square: [] });

      // Mock chrome.runtime.getURL to throw (simulating unavailability)
      const originalGetURL = chrome.runtime.getURL;
      (chrome.runtime.getURL as jest.Mock).mockImplementation(() => {
        throw new Error('Not available');
      });

      const result = getReplacementSrc('https://example.com/test.jpg', 500, 500);
      expect(result.src).toMatch(/^data:image\/svg\+xml/);
      expect(result.alt).toBe('Decorative image');

      // Restore
      chrome.runtime.getURL = originalGetURL;
    });

    it('returns deterministic results for the same URL', () => {
      setCachedReplacements({
        landscape: [
          'data:image/jpeg;base64,A',
          'data:image/jpeg;base64,B',
          'data:image/jpeg;base64,C',
        ],
        portrait: [],
        square: [],
      });

      const result1 = getReplacementSrc('https://example.com/image.jpg', 1920, 1080);
      const result2 = getReplacementSrc('https://example.com/image.jpg', 1920, 1080);
      expect(result1.src).toBe(result2.src);
    });

    it('returns different results for different URLs', () => {
      const images = Array.from({ length: 20 }, (_, i) => `data:image/jpeg;base64,img${i}`);
      setCachedReplacements({
        landscape: images,
        portrait: images,
        square: images,
      });

      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = getReplacementSrc(`https://example.com/image${i}.jpg`, 1920, 1080);
        results.add(result.src);
      }
      // Should have at least some variety
      expect(results.size).toBeGreaterThan(1);
    });

    it('selects correct bucket based on dimensions', () => {
      setCachedReplacements({
        landscape: ['data:image/jpeg;base64,LANDSCAPE'],
        portrait: ['data:image/jpeg;base64,PORTRAIT'],
        square: ['data:image/jpeg;base64,SQUARE'],
      });

      const landscape = getReplacementSrc('https://example.com/a.jpg', 1920, 1080);
      expect(landscape.src).toBe('data:image/jpeg;base64,LANDSCAPE');

      const portrait = getReplacementSrc('https://example.com/a.jpg', 1080, 1920);
      expect(portrait.src).toBe('data:image/jpeg;base64,PORTRAIT');

      const square = getReplacementSrc('https://example.com/a.jpg', 500, 500);
      expect(square.src).toBe('data:image/jpeg;base64,SQUARE');
    });

    it('alt text never contains blocked/restricted/nsfw/hidden', () => {
      setCachedReplacements({
        landscape: ['data:image/jpeg;base64,A'],
        portrait: ['data:image/jpeg;base64,B'],
        square: ['data:image/jpeg;base64,C'],
      });

      const forbiddenWords = ['blocked', 'restricted', 'nsfw', 'hidden'];

      for (const dims of [
        [1920, 1080],
        [1080, 1920],
        [500, 500],
      ] as [number, number][]) {
        const result = getReplacementSrc('https://example.com/test.jpg', dims[0], dims[1]);
        const altLower = result.alt.toLowerCase();
        for (const word of forbiddenWords) {
          expect(altLower).not.toContain(word);
        }
      }
    });

    it('alt text from Tier 2 (bundled) never contains forbidden words', () => {
      setCachedReplacements({ landscape: [], portrait: [], square: [] });

      const forbiddenWords = ['blocked', 'restricted', 'nsfw', 'hidden'];

      for (const dims of [
        [1920, 1080],
        [1080, 1920],
        [500, 500],
      ] as [number, number][]) {
        const result = getReplacementSrc('https://example.com/test.jpg', dims[0], dims[1]);
        const altLower = result.alt.toLowerCase();
        for (const word of forbiddenWords) {
          expect(altLower).not.toContain(word);
        }
      }
    });

    it('always returns a non-empty src', () => {
      setCachedReplacements({ landscape: [], portrait: [], square: [] });
      const result = getReplacementSrc('', 0, 0);
      expect(result.src).toBeTruthy();
      expect(result.src.length).toBeGreaterThan(0);
    });
  });
});
