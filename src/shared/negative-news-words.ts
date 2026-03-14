/**
 * Word lists for negative news content detection.
 * Used by the Good Vibes Mode scoring engine.
 */

import negativeNewsData from '../data/negative-news.json';

// Phrases matched first (longest match wins), then individual words
export const TRIGGER_PHRASES: string[] = [...negativeNewsData.triggerPhrases];

export const TRIGGER_WORDS: Set<string> = new Set(negativeNewsData.triggerWords);

export const TRIGGER_CATEGORIES: Record<string, string> = { ...negativeNewsData.triggerCategories };

// Phrase categories
export const PHRASE_CATEGORIES: Record<string, string> = { ...negativeNewsData.phraseCategories };

export const AMPLIFIER_WORDS: Set<string> = new Set(negativeNewsData.amplifierWords);

export const SAFE_CONTEXT_WORDS: Set<string> = new Set(negativeNewsData.safeContextWords);

/**
 * Add custom trigger words at runtime (user custom negative triggers).
 * Additive — used by word-list-updater for remote delta updates.
 */
export function addCustomTriggers(words: string[]): void {
  for (const word of words) {
    TRIGGER_WORDS.add(word.toLowerCase());
    TRIGGER_CATEGORIES[word.toLowerCase()] = 'custom';
  }
}

// Track custom trigger words so they can be cleared on reset
const CUSTOM_TRIGGER_WORDS = new Set<string>();

/**
 * Set (replace) custom trigger words. Clears previously added custom triggers
 * before adding the new list, so removed triggers stop being detected.
 */
export function setCustomTriggers(words: string[]): void {
  for (const w of CUSTOM_TRIGGER_WORDS) {
    TRIGGER_WORDS.delete(w);
    delete TRIGGER_CATEGORIES[w];
  }
  CUSTOM_TRIGGER_WORDS.clear();
  for (const word of words) {
    const lower = word.toLowerCase();
    TRIGGER_WORDS.add(lower);
    TRIGGER_CATEGORIES[lower] = 'custom';
    CUSTOM_TRIGGER_WORDS.add(lower);
  }
}

/**
 * Add custom safe context words at runtime (user custom safe contexts).
 * Additive — used by word-list-updater for remote delta updates.
 */
export function addCustomSafeContext(words: string[]): void {
  for (const word of words) {
    SAFE_CONTEXT_WORDS.add(word.toLowerCase());
  }
}

// Track custom safe context words so they can be cleared on reset
const CUSTOM_SAFE_CONTEXT = new Set<string>();

/**
 * Set (replace) custom safe context words. Clears previously added custom
 * safe context words before adding the new list.
 */
export function setCustomSafeContext(words: string[]): void {
  for (const w of CUSTOM_SAFE_CONTEXT) {
    SAFE_CONTEXT_WORDS.delete(w);
  }
  CUSTOM_SAFE_CONTEXT.clear();
  for (const word of words) {
    const lower = word.toLowerCase();
    SAFE_CONTEXT_WORDS.add(lower);
    CUSTOM_SAFE_CONTEXT.add(lower);
  }
}
