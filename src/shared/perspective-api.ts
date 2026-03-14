/**
 * Google Perspective API client for enhanced toxicity detection.
 * Optional — only used when the user provides an API key.
 */

const API_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

export interface PerspectiveResult {
  toxicity: number;
  profanity: number;
  insult: number;
  isToxic: boolean;
}

// Simple LRU cache for API results
const cache = new Map<string, PerspectiveResult>();
const MAX_CACHE_SIZE = 500;

// Rate limiter: max 1 request per second for free tier
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

function getCacheKey(text: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(hash);
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Analyze text using the Perspective API.
 * Returns toxicity scores for the given text.
 */
export async function analyzeText(
  text: string,
  apiKey: string,
): Promise<PerspectiveResult> {
  // Check cache first
  const cacheKey = getCacheKey(text);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await waitForRateLimit();

  const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comment: { text },
      languages: ['en'],
      requestedAttributes: {
        TOXICITY: {},
        PROFANITY: {},
        INSULT: {},
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Perspective API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const result: PerspectiveResult = {
    toxicity: data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0,
    profanity: data.attributeScores?.PROFANITY?.summaryScore?.value ?? 0,
    insult: data.attributeScores?.INSULT?.summaryScore?.value ?? 0,
    isToxic: false,
  };

  // Consider toxic if any score exceeds threshold
  result.isToxic =
    result.toxicity > 0.7 ||
    result.profanity > 0.7 ||
    result.insult > 0.8;

  // Store in cache (evict oldest if full)
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, result);

  return result;
}

/**
 * Test if an API key is valid by making a simple request.
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await analyzeText('test', apiKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the result cache.
 */
export function clearCache(): void {
  cache.clear();
}
