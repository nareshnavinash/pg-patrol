/**
 * Funny replacement word dictionary organized by starting letter.
 * When a swear word is detected, we pick a random funny word
 * that starts with the same letter for a fun, consistent feel.
 */

import funnyWordsData from '../data/funny-words.json';

// Mutable copy so custom words can be added at runtime
let funnyWords: Record<string, string[]> = { ...funnyWordsData.funnyWords };
const FALLBACK_WORDS = funnyWordsData.fallbackWords;

/**
 * Add custom funny replacement words at runtime.
 */
export function addCustomFunnyWords(additions: Record<string, string[]>): void {
  for (const [letter, words] of Object.entries(additions)) {
    funnyWords[letter] = [...(funnyWords[letter] ?? []), ...words];
  }
}

/**
 * Get a random funny replacement word that starts with the same letter
 * as the detected profanity, for a fun and consistent feel.
 */
export function getFunnyWord(profaneWord: string): string {
  const firstLetter = profaneWord.toLowerCase().charAt(0);
  const pool = funnyWords[firstLetter];

  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
}

/**
 * Seeded version for deterministic testing.
 */
export function getFunnyWordSeeded(profaneWord: string, seed: number): string {
  const firstLetter = profaneWord.toLowerCase().charAt(0);
  const pool = funnyWords[firstLetter];

  if (pool && pool.length > 0) {
    return pool[seed % pool.length];
  }

  return FALLBACK_WORDS[seed % FALLBACK_WORDS.length];
}

/**
 * Match the casing pattern of the original word.
 * ALL CAPS → ALL CAPS, Title Case → Title Case, lowercase → lowercase
 */
export function matchCase(replacement: string, original: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
