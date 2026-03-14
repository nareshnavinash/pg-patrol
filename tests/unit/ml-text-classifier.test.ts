import { classifyToxicity } from '../../src/shared/ml-text-classifier';
import { MessageType } from '../../src/shared/types';

describe('ml-text-classifier', () => {
  const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;

  beforeEach(() => {
    mockSendMessage.mockReset();
  });

  describe('classifyToxicity', () => {
    it('sends ML_CLASSIFY_REQUEST to background and returns result', async () => {
      mockSendMessage.mockResolvedValueOnce({ isToxic: true, confidence: 0.92 });

      const result = await classifyToxicity('you are worthless');

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: MessageType.ML_CLASSIFY_REQUEST,
        data: { text: 'you are worthless' },
      });
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.92);
    });

    it('returns safe result when background returns non-toxic', async () => {
      mockSendMessage.mockResolvedValueOnce({ isToxic: false, confidence: 0.1 });

      const result = await classifyToxicity('hello beautiful world');

      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.1);
    });

    it('returns safe fallback on sendMessage error', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Extension context invalidated'));

      const result = await classifyToxicity('some text');

      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('returns safe fallback on malformed response', async () => {
      mockSendMessage.mockResolvedValueOnce(undefined);

      const result = await classifyToxicity('some text');

      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('returns safe fallback on null response', async () => {
      mockSendMessage.mockResolvedValueOnce(null);

      const result = await classifyToxicity('some text');

      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('returns safe fallback when response missing isToxic field', async () => {
      mockSendMessage.mockResolvedValueOnce({ confidence: 0.8 });

      const result = await classifyToxicity('some text');

      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('passes the full text to the background', async () => {
      const longText = 'A'.repeat(1000);
      mockSendMessage.mockResolvedValueOnce({ isToxic: false, confidence: 0.05 });

      await classifyToxicity(longText);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: MessageType.ML_CLASSIFY_REQUEST,
        data: { text: longText },
      });
    });

    it('handles empty text gracefully', async () => {
      mockSendMessage.mockResolvedValueOnce({ isToxic: false, confidence: 0 });

      const result = await classifyToxicity('');

      expect(result.isToxic).toBe(false);
    });
  });
});
