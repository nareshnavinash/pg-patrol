/**
 * Tests for the filter worker proxy.
 * Mocks the Worker class to test message passing and fallback behavior.
 */

import { replaceProfanity } from '../../src/shared/profanity-engine';
import { scoreText } from '../../src/shared/negative-news-engine';

// Track posted messages and provide a way to simulate worker responses
let mockWorkerInstance: MockWorkerInstance | null = null;

class MockWorkerInstance {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();

  /** Simulate the worker posting a response back. */
  simulateResponse(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  /** Simulate a worker error. */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error'));
    }
  }
}

// Mock Worker constructor
(global as any).Worker = jest.fn().mockImplementation(() => {
  mockWorkerInstance = new MockWorkerInstance();
  return mockWorkerInstance;
});

// Mock chrome.runtime.getURL
(chrome.runtime.getURL as jest.Mock).mockReturnValue('chrome-extension://fake/filter-worker.js');

// Import after mocks are set up
import {
  initFilterWorker,
  filterTextBatch,
  scoreTextBatch,
  syncCustomWords,
  applyWorkerWordListDelta,
  terminateWorker,
  isWorkerActive,
} from '../../src/content/filter-worker-proxy';

describe('filter-worker-proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerInstance = null;
    // Reset module state by terminating any existing worker
    terminateWorker();
  });

  describe('initFilterWorker', () => {
    it('creates a Worker with the correct URL', () => {
      const result = initFilterWorker();

      expect(result).toBe(true);
      expect(global.Worker).toHaveBeenCalledWith(
        'chrome-extension://fake/filter-worker.js',
        { type: 'module' },
      );
    });

    it('returns true when worker is created successfully', () => {
      expect(initFilterWorker()).toBe(true);
      expect(isWorkerActive()).toBe(true);
    });

    it('returns false when Worker constructor throws', () => {
      (global as any).Worker = jest.fn().mockImplementation(() => {
        throw new Error('Workers not supported');
      });

      expect(initFilterWorker()).toBe(false);
      expect(isWorkerActive()).toBe(false);

      // Restore mock
      (global as any).Worker = jest.fn().mockImplementation(() => {
        mockWorkerInstance = new MockWorkerInstance();
        return mockWorkerInstance;
      });
    });

    it('recovers from worker errors up to 3 times, then gives up', () => {
      initFilterWorker();
      expect(isWorkerActive()).toBe(true);

      // First error: should reinitialize (crash recovery)
      mockWorkerInstance!.simulateError();
      expect(isWorkerActive()).toBe(true);

      // Second error: should reinitialize again
      mockWorkerInstance!.simulateError();
      expect(isWorkerActive()).toBe(true);

      // Third error: max retries reached, gives up permanently
      mockWorkerInstance!.simulateError();
      expect(isWorkerActive()).toBe(false);
    });
  });

  describe('filterTextBatch', () => {
    it('sends FILTER_TEXT message to worker', async () => {
      initFilterWorker();

      const promise = filterTextBatch(['hello', 'world'], 'moderate');

      // Verify message was posted
      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FILTER_TEXT',
          texts: ['hello', 'world'],
          sensitivity: 'moderate',
        }),
      );

      // Simulate worker response
      const id = mockWorkerInstance!.postMessage.mock.calls[0][0].id;
      mockWorkerInstance!.simulateResponse({
        type: 'FILTER_TEXT_RESULT',
        id,
        results: [
          { original: 'hello', filtered: 'hello', replacements: [], profaneUrls: [], hasProfanity: false },
          { original: 'world', filtered: 'world', replacements: [], profaneUrls: [], hasProfanity: false },
        ],
      });

      const results = await promise;
      expect(results).toHaveLength(2);
      expect(results[0].hasProfanity).toBe(false);
    });

    it('falls back to sync when worker is not active', async () => {
      // Don't init worker — no worker available
      const results = await filterTextBatch(['hello world'], 'moderate');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(replaceProfanity('hello world', 'moderate'));
    });

    it('falls back to sync on timeout', async () => {
      jest.useFakeTimers();
      initFilterWorker();

      const promise = filterTextBatch(['hello'], 'moderate');

      // Don't simulate a worker response — let it timeout
      jest.advanceTimersByTime(5001);

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(replaceProfanity('hello', 'moderate'));

      jest.useRealTimers();
    });

    it('handles multiple concurrent requests', async () => {
      initFilterWorker();

      const promise1 = filterTextBatch(['text1'], 'moderate');
      const promise2 = filterTextBatch(['text2'], 'strict');

      // Get the IDs from posted messages
      const id1 = mockWorkerInstance!.postMessage.mock.calls[0][0].id;
      const id2 = mockWorkerInstance!.postMessage.mock.calls[1][0].id;

      // Respond in reverse order
      mockWorkerInstance!.simulateResponse({
        type: 'FILTER_TEXT_RESULT',
        id: id2,
        results: [{ original: 'text2', filtered: 'text2', replacements: [], profaneUrls: [], hasProfanity: false }],
      });
      mockWorkerInstance!.simulateResponse({
        type: 'FILTER_TEXT_RESULT',
        id: id1,
        results: [{ original: 'text1', filtered: 'text1', replacements: [], profaneUrls: [], hasProfanity: false }],
      });

      const [results1, results2] = await Promise.all([promise1, promise2]);
      expect(results1[0].original).toBe('text1');
      expect(results2[0].original).toBe('text2');
    });
  });

  describe('scoreTextBatch', () => {
    it('sends SCORE_TEXT message to worker', async () => {
      initFilterWorker();

      const promise = scoreTextBatch(['hello world']);

      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SCORE_TEXT',
          texts: ['hello world'],
        }),
      );

      const id = mockWorkerInstance!.postMessage.mock.calls[0][0].id;
      mockWorkerInstance!.simulateResponse({
        type: 'SCORE_TEXT_RESULT',
        id,
        results: [{ isNegative: false, score: 0, matches: [] }],
      });

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(results[0].isNegative).toBe(false);
    });

    it('falls back to sync when worker is not active', async () => {
      const results = await scoreTextBatch(['hello world']);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(scoreText('hello world'));
    });

    it('falls back to sync on timeout', async () => {
      jest.useFakeTimers();
      initFilterWorker();

      const promise = scoreTextBatch(['hello']);

      jest.advanceTimersByTime(5001);

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(scoreText('hello'));

      jest.useRealTimers();
    });
  });

  describe('syncCustomWords', () => {
    it('sends SET_CUSTOM_WORDS message to worker', () => {
      initFilterWorker();

      syncCustomWords({
        customBlockedWords: ['bad'],
        customSafeWords: ['good'],
        customNegativeTriggers: ['trigger'],
        customSafeContext: ['safe'],
      });

      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith({
        type: 'SET_CUSTOM_WORDS',
        customBlockedWords: ['bad'],
        customSafeWords: ['good'],
        customNegativeTriggers: ['trigger'],
        customSafeContext: ['safe'],
      });
    });

    it('does nothing when worker is not active', () => {
      // No worker initialized — should not throw
      syncCustomWords({
        customBlockedWords: [],
        customSafeWords: [],
        customNegativeTriggers: [],
        customSafeContext: [],
      });
    });
  });

  describe('applyWorkerWordListDelta', () => {
    it('sends APPLY_WORD_DELTA message to worker', () => {
      initFilterWorker();

      const delta = {
        version: 1,
        lastModified: '2026-01-01',
        profanity: { add: ['newword'] },
      };

      applyWorkerWordListDelta(delta);

      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith({
        type: 'APPLY_WORD_DELTA',
        delta,
      });
    });

    it('does nothing when worker is not active', () => {
      applyWorkerWordListDelta({ version: 1, lastModified: '2026-01-01' });
      // Should not throw
    });
  });

  describe('terminateWorker', () => {
    it('calls terminate() on the worker', () => {
      initFilterWorker();
      const instance = mockWorkerInstance!;

      terminateWorker();

      expect(instance.terminate).toHaveBeenCalled();
      expect(isWorkerActive()).toBe(false);
    });

    it('resolves pending requests with empty arrays', async () => {
      initFilterWorker();

      const promise = filterTextBatch(['text'], 'moderate');

      terminateWorker();

      const results = await promise;
      expect(results).toEqual([]);
    });

    it('does nothing when no worker exists', () => {
      // Should not throw
      terminateWorker();
    });
  });

  describe('isWorkerActive', () => {
    it('returns false before init', () => {
      expect(isWorkerActive()).toBe(false);
    });

    it('returns true after successful init', () => {
      initFilterWorker();
      expect(isWorkerActive()).toBe(true);
    });

    it('returns false after terminate', () => {
      initFilterWorker();
      terminateWorker();
      expect(isWorkerActive()).toBe(false);
    });
  });
});
