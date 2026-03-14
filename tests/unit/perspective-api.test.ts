import { analyzeText, testApiKey, clearCache } from '../../src/shared/perspective-api';

// Mock global fetch
const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

describe('perspective-api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearCache();
  });

  describe('analyzeText', () => {
    it('returns toxicity scores from API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.9 } },
              PROFANITY: { summaryScore: { value: 0.85 } },
              INSULT: { summaryScore: { value: 0.2 } },
            },
          }),
      });

      const result = await analyzeText('some bad text', 'test-key');
      expect(result.toxicity).toBe(0.9);
      expect(result.profanity).toBe(0.85);
      expect(result.insult).toBe(0.2);
      expect(result.isToxic).toBe(true);
    });

    it('marks non-toxic text as not toxic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.1 } },
              PROFANITY: { summaryScore: { value: 0.05 } },
              INSULT: { summaryScore: { value: 0.1 } },
            },
          }),
      });

      const result = await analyzeText('hello world', 'test-key');
      expect(result.isToxic).toBe(false);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(analyzeText('test', 'bad-key')).rejects.toThrow(
        'Perspective API error: 403',
      );
    });

    it('uses cache for repeated text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.5 } },
              PROFANITY: { summaryScore: { value: 0.3 } },
              INSULT: { summaryScore: { value: 0.2 } },
            },
          }),
      });

      await analyzeText('same text', 'test-key');
      const result2 = await analyzeText('same text', 'test-key');

      // Should only call fetch once (second time from cache)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.toxicity).toBe(0.5);
    });
  });

  describe('testApiKey', () => {
    it('returns true for valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.1 } },
              PROFANITY: { summaryScore: { value: 0.1 } },
              INSULT: { summaryScore: { value: 0.1 } },
            },
          }),
      });

      const valid = await testApiKey('valid-key');
      expect(valid).toBe(true);
    });

    it('returns false for invalid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const valid = await testApiKey('invalid-key');
      expect(valid).toBe(false);
    });
  });
});
