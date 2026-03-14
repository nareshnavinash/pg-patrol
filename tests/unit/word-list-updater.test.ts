import {
  shouldFetch,
  getCachedWordList,
  applyWordListDelta,
  loadRemoteWordList,
  type RemoteWordListDelta,
} from '../../src/shared/word-list-updater';
import { containsProfanity } from '../../src/shared/profanity-engine';

// Access the mock chrome storage
const mockLocalStorage: Record<string, unknown> = {};

beforeEach(() => {
  // Reset local storage mock
  Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

  (chrome.storage.local.get as jest.Mock).mockImplementation(
    (keys: string | string[]) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockLocalStorage[keys] });
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        result[key] = mockLocalStorage[key];
      }
      return Promise.resolve(result);
    },
  );

  (chrome.storage.local.set as jest.Mock).mockImplementation(
    (items: Record<string, unknown>) => {
      Object.assign(mockLocalStorage, items);
      return Promise.resolve();
    },
  );
});

describe('word-list-updater', () => {
  describe('shouldFetch', () => {
    it('returns true when no cached data exists', async () => {
      expect(await shouldFetch()).toBe(true);
    });

    it('returns false when data was fetched recently', async () => {
      mockLocalStorage['remoteWordList'] = {
        delta: { version: 1, lastModified: '2026-03-13T00:00:00Z' },
        lastFetched: Date.now(),
      };
      expect(await shouldFetch()).toBe(false);
    });

    it('returns true when data is older than 24 hours', async () => {
      mockLocalStorage['remoteWordList'] = {
        delta: { version: 1, lastModified: '2026-03-12T00:00:00Z' },
        lastFetched: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      expect(await shouldFetch()).toBe(true);
    });
  });

  describe('getCachedWordList', () => {
    it('returns null when no cached data exists', async () => {
      expect(await getCachedWordList()).toBeNull();
    });

    it('returns cached delta when it exists', async () => {
      const delta: RemoteWordListDelta = {
        version: 1,
        lastModified: '2026-03-13T00:00:00Z',
        profanity: { add: ['testword'] },
      };
      mockLocalStorage['remoteWordList'] = {
        delta,
        lastFetched: Date.now(),
      };

      const result = await getCachedWordList();
      expect(result).toEqual(delta);
    });
  });

  describe('applyWordListDelta', () => {
    it('adds profanity words from delta', () => {
      const delta: RemoteWordListDelta = {
        version: 1,
        lastModified: '2026-03-13T00:00:00Z',
        profanity: {
          add: ['grumbletron'],
        },
      };

      // Before applying, word should not be profane
      expect(containsProfanity('grumbletron detected', 'strict')).toBe(false);

      applyWordListDelta(delta);

      // After applying, word should be detected
      expect(containsProfanity('grumbletron detected', 'strict')).toBe(true);
    });

    it('handles delta with all fields populated', () => {
      const delta: RemoteWordListDelta = {
        version: 2,
        lastModified: '2026-03-13T00:00:00Z',
        profanity: {
          add: ['wibbleflop'],
          addSafe: ['wibbleflop_safe'],
        },
        negativeNews: {
          addTriggers: ['cyberblast'],
          addSafeContext: ['speedrunning'],
        },
        funnyWords: {
          add: { w: ['wonderful wombats'] },
        },
      };

      // Should not throw
      expect(() => applyWordListDelta(delta)).not.toThrow();
    });

    it('handles empty delta gracefully', () => {
      const delta: RemoteWordListDelta = {
        version: 1,
        lastModified: '2026-03-13T00:00:00Z',
      };

      expect(() => applyWordListDelta(delta)).not.toThrow();
    });
  });

  describe('loadRemoteWordList', () => {
    it('applies cached word list on load', async () => {
      const delta: RemoteWordListDelta = {
        version: 1,
        lastModified: '2026-03-13T00:00:00Z',
        profanity: { add: ['snorklewort'] },
      };
      mockLocalStorage['remoteWordList'] = {
        delta,
        lastFetched: Date.now(),
      };

      await loadRemoteWordList();

      expect(containsProfanity('snorklewort found', 'strict')).toBe(true);
    });

    it('returns null when no cached data', async () => {
      // Should not throw
      await expect(loadRemoteWordList()).resolves.toBeNull();
    });
  });
});
