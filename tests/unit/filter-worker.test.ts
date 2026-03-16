/**
 * Tests for the filter Web Worker message handler.
 * Tests handleWorkerMessage directly (no actual Worker needed).
 */

import { handleWorkerMessage } from '../../src/content/filter-worker';
import type { WorkerRequest, WorkerResponse } from '../../src/content/filter-worker';
import { replaceProfanity } from '../../src/shared/profanity-engine';
import { scoreText } from '../../src/shared/negative-news-engine';

// We test the handler function, not the actual Worker self-registration.
// The handler imports are tested via their real implementations.

describe('filter-worker handleWorkerMessage', () => {
  describe('FILTER_TEXT', () => {
    it('returns FilterResult array for a batch of texts', () => {
      const request: WorkerRequest = {
        type: 'FILTER_TEXT',
        id: 1,
        texts: ['hello world', 'this is clean text'],
        sensitivity: 'moderate',
      };

      const response = handleWorkerMessage(request);

      expect(response).toBeDefined();
      expect(response!.type).toBe('FILTER_TEXT_RESULT');
      expect((response as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>).id).toBe(1);
      expect(
        (response as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>).results,
      ).toHaveLength(2);
    });

    it('produces same results as calling replaceProfanity directly', () => {
      const texts = ['hello world', 'some clean text'];
      const sensitivity = 'moderate' as const;

      const request: WorkerRequest = {
        type: 'FILTER_TEXT',
        id: 2,
        texts,
        sensitivity,
      };

      const response = handleWorkerMessage(request) as Extract<
        WorkerResponse,
        { type: 'FILTER_TEXT_RESULT' }
      >;
      const directResults = texts.map((t) => replaceProfanity(t, sensitivity));

      expect(response.results).toEqual(directResults);
    });

    it('handles empty text array', () => {
      const request: WorkerRequest = {
        type: 'FILTER_TEXT',
        id: 3,
        texts: [],
        sensitivity: 'moderate',
      };

      const response = handleWorkerMessage(request) as Extract<
        WorkerResponse,
        { type: 'FILTER_TEXT_RESULT' }
      >;
      expect(response.results).toEqual([]);
    });

    it('respects sensitivity parameter', () => {
      const texts = ['some text'];

      const mildResponse = handleWorkerMessage({
        type: 'FILTER_TEXT',
        id: 4,
        texts,
        sensitivity: 'mild',
      }) as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>;

      const strictResponse = handleWorkerMessage({
        type: 'FILTER_TEXT',
        id: 5,
        texts,
        sensitivity: 'strict',
      }) as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>;

      // Both should return results (content may differ by sensitivity)
      expect(mildResponse.results).toHaveLength(1);
      expect(strictResponse.results).toHaveLength(1);
    });

    it('preserves request id in response', () => {
      const response = handleWorkerMessage({
        type: 'FILTER_TEXT',
        id: 42,
        texts: ['test'],
        sensitivity: 'moderate',
      });

      expect(response).toBeDefined();
      expect((response as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>).id).toBe(42);
    });
  });

  describe('SCORE_TEXT', () => {
    it('returns NegativeContentResult array for a batch of texts', () => {
      const request: WorkerRequest = {
        type: 'SCORE_TEXT',
        id: 10,
        texts: ['beautiful sunny day', 'nice weather'],
      };

      const response = handleWorkerMessage(request);

      expect(response).toBeDefined();
      expect(response!.type).toBe('SCORE_TEXT_RESULT');
      expect((response as Extract<WorkerResponse, { type: 'SCORE_TEXT_RESULT' }>).id).toBe(10);
      expect(
        (response as Extract<WorkerResponse, { type: 'SCORE_TEXT_RESULT' }>).results,
      ).toHaveLength(2);
    });

    it('produces same results as calling scoreText directly', () => {
      const texts = ['beautiful day', 'some text'];

      const request: WorkerRequest = {
        type: 'SCORE_TEXT',
        id: 11,
        texts,
      };

      const response = handleWorkerMessage(request) as Extract<
        WorkerResponse,
        { type: 'SCORE_TEXT_RESULT' }
      >;
      const directResults = texts.map((t) => scoreText(t));

      expect(response.results).toEqual(directResults);
    });

    it('handles empty text array', () => {
      const request: WorkerRequest = {
        type: 'SCORE_TEXT',
        id: 12,
        texts: [],
      };

      const response = handleWorkerMessage(request) as Extract<
        WorkerResponse,
        { type: 'SCORE_TEXT_RESULT' }
      >;
      expect(response.results).toEqual([]);
    });

    it('returns score and isNegative fields', () => {
      const response = handleWorkerMessage({
        type: 'SCORE_TEXT',
        id: 13,
        texts: ['hello world'],
      }) as Extract<WorkerResponse, { type: 'SCORE_TEXT_RESULT' }>;

      expect(response.results[0]).toHaveProperty('score');
      expect(response.results[0]).toHaveProperty('isNegative');
      expect(response.results[0]).toHaveProperty('matches');
    });
  });

  describe('SET_CUSTOM_WORDS', () => {
    it('returns undefined (no response needed)', () => {
      const response = handleWorkerMessage({
        type: 'SET_CUSTOM_WORDS',
        customBlockedWords: ['badword'],
        customSafeWords: [],
        customNegativeTriggers: [],
        customSafeContext: [],
      });

      expect(response).toBeUndefined();
    });

    it('applies custom blocked words to profanity engine', () => {
      // Set a custom word
      handleWorkerMessage({
        type: 'SET_CUSTOM_WORDS',
        customBlockedWords: ['unicorn'],
        customSafeWords: [],
        customNegativeTriggers: [],
        customSafeContext: [],
      });

      // Now filter text containing the custom word
      const response = handleWorkerMessage({
        type: 'FILTER_TEXT',
        id: 20,
        texts: ['I saw a unicorn'],
        sensitivity: 'moderate',
      }) as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>;

      expect(response.results[0].hasProfanity).toBe(true);

      // Clean up
      handleWorkerMessage({
        type: 'SET_CUSTOM_WORDS',
        customBlockedWords: [],
        customSafeWords: [],
        customNegativeTriggers: [],
        customSafeContext: [],
      });
    });
  });

  describe('APPLY_WORD_DELTA', () => {
    it('returns undefined (no response needed)', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: { version: 1, lastModified: '2026-01-01' },
      });

      expect(response).toBeUndefined();
    });

    it('applies profanity delta additions', () => {
      handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          profanity: { add: ['zorplex'] },
        },
      });

      const response = handleWorkerMessage({
        type: 'FILTER_TEXT',
        id: 30,
        texts: ['I found a zorplex'],
        sensitivity: 'moderate',
      }) as Extract<WorkerResponse, { type: 'FILTER_TEXT_RESULT' }>;

      expect(response.results[0].hasProfanity).toBe(true);
    });

    it('handles delta with no fields gracefully', () => {
      // Should not throw
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: { version: 1, lastModified: '2026-01-01' },
      });

      expect(response).toBeUndefined();
    });

    it('applies profanity addSafe delta', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          profanity: { addSafe: ['safeword123'] },
        },
      });
      expect(response).toBeUndefined();
    });

    it('applies negativeNews triggers and safe context', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          negativeNews: {
            addTriggers: ['badnews_trigger'],
            addSafeContext: ['safe_context_word'],
          },
        },
      });
      expect(response).toBeUndefined();
    });

    it('applies funnyWords delta', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          funnyWords: { add: { f: ['fluffy unicorns'] } },
        },
      });
      expect(response).toBeUndefined();
    });

    it('handles delta with profanity but no addSafe', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          profanity: { add: ['sometestword999'] },
        },
      });
      expect(response).toBeUndefined();
    });

    it('handles delta with negativeNews but empty arrays', () => {
      const response = handleWorkerMessage({
        type: 'APPLY_WORD_DELTA',
        delta: {
          version: 1,
          lastModified: '2026-01-01',
          negativeNews: { addTriggers: [], addSafeContext: [] },
        },
      });
      expect(response).toBeUndefined();
    });
  });
});
