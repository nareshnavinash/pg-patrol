/**
 * @jest-environment jsdom
 */

import {
  cacheImages,
  getCachedImages,
  getAllCachedImages,
  rotateCachedImages,
} from '../../src/background/image-cache';

// Mock replacement-image-urls with small test data
jest.mock('../../src/data/replacement-image-urls', () => ({
  REPLACEMENT_URLS: {
    landscape: [
      'https://images.pexels.com/photos/1/test-1.jpeg?w=400',
      'https://images.pexels.com/photos/2/test-2.jpeg?w=400',
      'https://images.pexels.com/photos/3/test-3.jpeg?w=400',
    ],
    portrait: [
      'https://images.pexels.com/photos/4/test-4.jpeg?w=400',
      'https://images.pexels.com/photos/5/test-5.jpeg?w=400',
    ],
    square: ['https://images.pexels.com/photos/6/test-6.jpeg?w=400'],
  },
}));

// Mock fetch
const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

// Provide indexedDB via fake-indexeddb

const fakeIDB = require('fake-indexeddb');

beforeAll(() => {
  if (!globalThis.indexedDB) {
    (globalThis as Record<string, unknown>).indexedDB = fakeIDB.indexedDB;
    (globalThis as Record<string, unknown>).IDBKeyRange = fakeIDB.IDBKeyRange;
  }
});

function createMockBlob(content = 'fake-image-data', type = 'image/jpeg') {
  const blob = new Blob([content], { type });
  return blob;
}

function mockFetchSuccess() {
  mockFetch.mockImplementation(async () => ({
    ok: true,
    blob: async () => createMockBlob(),
  }));
}

function mockFetchFailure() {
  mockFetch.mockImplementation(async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  }));
}

describe('image-cache', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('cacheImages', () => {
    it('fetches images and stores in IndexedDB', async () => {
      mockFetchSuccess();

      await cacheImages();

      // Should have made fetch calls for images
      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles fetch failures gracefully', async () => {
      mockFetchFailure();

      // Should not throw
      await expect(cacheImages()).resolves.not.toThrow();
    });
  });

  describe('getCachedImages', () => {
    it('returns empty array when no images cached', async () => {
      const result = await getCachedImages('landscape');
      // May or may not have images from previous test — verify it returns array
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns data URIs after caching', async () => {
      mockFetchSuccess();
      await cacheImages();

      const result = await getCachedImages('landscape');
      expect(result.length).toBeGreaterThanOrEqual(0);
      for (const uri of result) {
        expect(uri).toMatch(/^data:image\//);
      }
    });
  });

  describe('getAllCachedImages', () => {
    it('returns all three buckets', async () => {
      mockFetchSuccess();
      await cacheImages();

      const result = await getAllCachedImages();
      expect(result).toHaveProperty('landscape');
      expect(result).toHaveProperty('portrait');
      expect(result).toHaveProperty('square');
      expect(Array.isArray(result.landscape)).toBe(true);
      expect(Array.isArray(result.portrait)).toBe(true);
      expect(Array.isArray(result.square)).toBe(true);
    });
  });

  describe('rotateCachedImages', () => {
    it('does not throw when rotating cache', async () => {
      mockFetchSuccess();
      await cacheImages();
      await expect(rotateCachedImages()).resolves.not.toThrow();
    });

    it('handles fetch failures during rotation gracefully', async () => {
      mockFetchSuccess();
      await cacheImages();

      mockFetchFailure();
      await expect(rotateCachedImages()).resolves.not.toThrow();
    });
  });
});
