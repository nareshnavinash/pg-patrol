import {
  isChromeAiAvailable,
  classifyWithChromeAi,
  parseResponse,
  destroyChromeAiSession,
  resetAvailabilityCache,
} from '../../src/shared/chrome-ai';

describe('chrome-ai', () => {
  let originalAi: any;

  const mockPrompt = jest.fn();
  const mockDestroy = jest.fn();
  const mockCreate = jest.fn();
  const mockCapabilities = jest.fn();

  beforeEach(() => {
    // Save and clear any existing ai property
    originalAi = (globalThis as any).ai;

    // Reset mocks
    mockPrompt.mockReset();
    mockDestroy.mockReset();
    mockCreate.mockReset();
    mockCapabilities.mockReset();

    // Reset module state
    resetAvailabilityCache();
    destroyChromeAiSession();

    // Default: Chrome AI is available
    mockCapabilities.mockResolvedValue({ available: 'readily' });
    mockCreate.mockResolvedValue({ prompt: mockPrompt, destroy: mockDestroy });

    (globalThis as any).ai = {
      languageModel: {
        capabilities: mockCapabilities,
        create: mockCreate,
      },
    };
  });

  afterEach(() => {
    // Restore original state
    if (originalAi !== undefined) {
      (globalThis as any).ai = originalAi;
    } else {
      delete (globalThis as any).ai;
    }
  });

  describe('isChromeAiAvailable', () => {
    it('returns true when Chrome AI is readily available', async () => {
      expect(await isChromeAiAvailable()).toBe(true);
    });

    it('returns false when ai is not on globalThis', async () => {
      delete (globalThis as any).ai;
      expect(await isChromeAiAvailable()).toBe(false);
    });

    it('returns false when ai.languageModel is missing', async () => {
      (globalThis as any).ai = {};
      expect(await isChromeAiAvailable()).toBe(false);
    });

    it('returns false when capabilities.available is "no"', async () => {
      mockCapabilities.mockResolvedValue({ available: 'no' });
      expect(await isChromeAiAvailable()).toBe(false);
    });

    it('returns false when capabilities.available is "after-download"', async () => {
      mockCapabilities.mockResolvedValue({ available: 'after-download' });
      expect(await isChromeAiAvailable()).toBe(false);
    });

    it('returns false when capabilities() throws', async () => {
      mockCapabilities.mockRejectedValue(new Error('API error'));
      expect(await isChromeAiAvailable()).toBe(false);
    });

    it('caches the result after first check', async () => {
      await isChromeAiAvailable();
      await isChromeAiAvailable();
      // capabilities should only be called once
      expect(mockCapabilities).toHaveBeenCalledTimes(1);
    });

    it('resetAvailabilityCache allows re-checking', async () => {
      await isChromeAiAvailable(); // first check
      resetAvailabilityCache();
      await isChromeAiAvailable(); // second check
      expect(mockCapabilities).toHaveBeenCalledTimes(2);
    });
  });

  describe('classifyWithChromeAi', () => {
    it('returns toxic result when model responds "toxic"', async () => {
      mockPrompt.mockResolvedValue('toxic');
      const result = await classifyWithChromeAi('you are worthless');
      expect(result).not.toBeNull();
      expect(result!.isToxic).toBe(true);
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it('returns safe result when model responds "safe"', async () => {
      mockPrompt.mockResolvedValue('safe');
      const result = await classifyWithChromeAi('hello beautiful world');
      expect(result).not.toBeNull();
      expect(result!.isToxic).toBe(false);
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it('returns null when Chrome AI is not available', async () => {
      delete (globalThis as any).ai;
      resetAvailabilityCache();
      const result = await classifyWithChromeAi('some text');
      expect(result).toBeNull();
    });

    it('returns null when prompt() throws', async () => {
      mockPrompt.mockRejectedValue(new Error('Model error'));
      const result = await classifyWithChromeAi('some text');
      expect(result).toBeNull();
    });

    it('returns null when session creation fails', async () => {
      mockCreate.mockRejectedValue(new Error('Cannot create session'));
      const result = await classifyWithChromeAi('some text');
      expect(result).toBeNull();
    });

    it('truncates text longer than 500 chars', async () => {
      mockPrompt.mockResolvedValue('safe');
      const longText = 'A'.repeat(600);

      await classifyWithChromeAi(longText);

      const promptArg = mockPrompt.mock.calls[0][0] as string;
      // The truncated text should end with "..."
      expect(promptArg).toContain('...');
      // The full 600-char text should not appear
      expect(promptArg).not.toContain(longText);
    });

    it('passes short text without truncation', async () => {
      mockPrompt.mockResolvedValue('safe');

      await classifyWithChromeAi('short text');

      const promptArg = mockPrompt.mock.calls[0][0] as string;
      expect(promptArg).toContain('short text');
      expect(promptArg).not.toContain('...');
    });

    it('creates session with correct system prompt and settings', async () => {
      mockPrompt.mockResolvedValue('safe');

      await classifyWithChromeAi('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('content safety classifier'),
          temperature: 0,
          topK: 1,
        }),
      );
    });

    it('reuses the session across multiple calls', async () => {
      mockPrompt.mockResolvedValue('safe');

      await classifyWithChromeAi('first');
      await classifyWithChromeAi('second');

      // Session should only be created once
      expect(mockCreate).toHaveBeenCalledTimes(1);
      // But prompt should be called twice
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseResponse', () => {
    it('parses exact "toxic" response', () => {
      const result = parseResponse('toxic');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it('parses exact "safe" response', () => {
      const result = parseResponse('safe');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.8);
    });

    it('parses "Toxic" (case-insensitive)', () => {
      const result = parseResponse('Toxic');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it('parses "SAFE" (case-insensitive)', () => {
      const result = parseResponse('SAFE');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.8);
    });

    it('parses verbose response containing "toxic"', () => {
      const result = parseResponse('The text is toxic because it contains insults');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.65);
    });

    it('parses verbose response containing "safe"', () => {
      const result = parseResponse('This text appears to be safe and harmless');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.65);
    });

    it('when response has both "toxic" and "safe", picks whichever comes first', () => {
      const toxicFirst = parseResponse('This is toxic, not safe at all');
      expect(toxicFirst.isToxic).toBe(true);

      const safeFirst = parseResponse('This is safe, not toxic content');
      expect(safeFirst.isToxic).toBe(false);
    });

    it('detects "harmful" as toxic synonym', () => {
      const result = parseResponse('This content is harmful');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.55);
    });

    it('detects "negative" as toxic synonym', () => {
      const result = parseResponse('This is negative content');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.55);
    });

    it('detects "violent" as toxic synonym', () => {
      const result = parseResponse('This describes violent acts');
      expect(result.isToxic).toBe(true);
      expect(result.confidence).toBe(0.55);
    });

    it('returns non-toxic with low confidence for unrecognizable response', () => {
      const result = parseResponse('I cannot determine the nature of this text');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.3);
    });

    it('handles empty response', () => {
      const result = parseResponse('');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.3);
    });

    it('handles whitespace-only response', () => {
      const result = parseResponse('   \n  ');
      expect(result.isToxic).toBe(false);
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('destroyChromeAiSession', () => {
    it('calls destroy() on the active session', async () => {
      mockPrompt.mockResolvedValue('safe');
      await classifyWithChromeAi('test'); // creates session

      destroyChromeAiSession();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('does nothing if no session exists', () => {
      // Should not throw
      destroyChromeAiSession();
      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it('creates a new session after destroy', async () => {
      mockPrompt.mockResolvedValue('safe');
      await classifyWithChromeAi('first'); // creates session
      destroyChromeAiSession();
      await classifyWithChromeAi('second'); // creates new session

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('handles destroy() throwing without error', async () => {
      mockPrompt.mockResolvedValue('safe');
      mockDestroy.mockImplementation(() => {
        throw new Error('Already destroyed');
      });
      await classifyWithChromeAi('test');

      // Should not throw
      destroyChromeAiSession();
    });
  });
});
