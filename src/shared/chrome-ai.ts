/**
 * Chrome Built-In AI wrapper (Gemini Nano, Chrome 131+).
 * Tier 2 classifier — opportunistic, zero cost, fully local.
 *
 * Feature-detects `self.ai.languageModel` and uses it for nuanced
 * re-classification of borderline content. Silent no-op when unavailable.
 */

export interface ChromeAiResult {
  isToxic: boolean;
  confidence: number;
}

// Cached availability check — null means not yet checked
let availabilityCache: boolean | null = null;

// Reusable session — created once, reused across calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionPromise: Promise<any> | null = null;

const SYSTEM_PROMPT =
  'You are a content safety classifier. Given text, determine if it is toxic, harmful, ' +
  'hateful, violent, or contains disturbing negative content. ' +
  'Respond with ONLY one word: "toxic" or "safe". Nothing else.';

/**
 * Check if Chrome Built-In AI (Gemini Nano) is available and ready.
 * Result is cached after the first check.
 */
export async function isChromeAiAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ai = (globalThis as any).ai;
    if (!ai?.languageModel) {
      availabilityCache = false;
      return false;
    }

    const capabilities = await ai.languageModel.capabilities();
    availabilityCache = capabilities.available === 'readily';
    return availabilityCache;
  } catch {
    availabilityCache = false;
    return false;
  }
}

/**
 * Get or create a reusable language model session.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSession(): Promise<any> {
  if (session) return session;

  if (!sessionPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ai = (globalThis as any).ai;
    sessionPromise = ai.languageModel
      .create({
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0,
        topK: 1,
      })
      .then((s: unknown) => {
        session = s;
        sessionPromise = null;
        return session;
      })
      .catch((err: unknown) => {
        sessionPromise = null;
        throw err;
      });
  }

  return sessionPromise;
}

/**
 * Classify text using Chrome Built-In AI.
 * Returns null if Chrome AI is not available or if classification fails.
 * Truncates input to 500 chars to stay within Gemini Nano's context budget.
 */
export async function classifyWithChromeAi(text: string): Promise<ChromeAiResult | null> {
  try {
    if (!(await isChromeAiAvailable())) return null;

    const sess = await getSession();
    const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text;
    const response: string = await sess.prompt(`Is this text toxic or safe?\n\n"${truncated}"`);

    return parseResponse(response);
  } catch {
    // Any failure — return null (caller falls back to ML result)
    return null;
  }
}

/**
 * Parse the model's response into a structured result.
 * Expects "toxic" or "safe" but handles verbose/unexpected responses.
 */
export function parseResponse(response: string): ChromeAiResult {
  const lower = response.toLowerCase().trim();

  // Best case: model responded with just the word
  if (lower === 'toxic') return { isToxic: true, confidence: 0.8 };
  if (lower === 'safe') return { isToxic: false, confidence: 0.8 };

  // Model was verbose — check which word appears first
  const toxicIdx = lower.indexOf('toxic');
  const safeIdx = lower.indexOf('safe');

  if (toxicIdx !== -1 && (safeIdx === -1 || toxicIdx < safeIdx)) {
    return { isToxic: true, confidence: 0.65 };
  }
  if (safeIdx !== -1) {
    return { isToxic: false, confidence: 0.65 };
  }

  // Check for synonyms
  if (lower.includes('harmful') || lower.includes('negative') || lower.includes('violent')) {
    return { isToxic: true, confidence: 0.55 };
  }

  // Can't determine — treat as uncertain non-toxic
  return { isToxic: false, confidence: 0.3 };
}

/**
 * Destroy the cached session. Called when the content script is torn down
 * or when Chrome AI becomes unavailable.
 */
export function destroyChromeAiSession(): void {
  if (session) {
    try {
      session.destroy();
    } catch {
      // Session may already be destroyed
    }
    session = null;
  }
  sessionPromise = null;
}

/**
 * Reset the availability cache. Useful for testing or after Chrome updates.
 */
export function resetAvailabilityCache(): void {
  availabilityCache = null;
}
