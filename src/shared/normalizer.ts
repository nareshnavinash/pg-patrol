/**
 * Leetspeak normalizer — converts common character substitutions,
 * unicode homoglyphs, separators, and repeated characters back to
 * standard Latin letters for profanity matching.
 */

// Leetspeak / symbol → letter mapping
const LEET_MAP: Record<string, string> = {
  '4': 'a',
  '@': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  $: 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '|': 'l',
  '9': 'g',
  '(': 'c',
  '6': 'g',
};

// 2.1: Fast path regex — plain lowercase ASCII with no 3+ repeated chars needs no normalization
const PLAIN_ASCII_RE = /^[a-z]+$/;
const HAS_REPEAT_RUN = /(.)\1{2,}/;

// 2.1: Combined map merging homoglyphs and leetspeak into a single pass
const COMBINED_MAP: Record<string, string> = {};

// Unicode homoglyph → ASCII mapping (Cyrillic, etc.)
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', // Cyrillic а
  '\u0435': 'e', // Cyrillic е
  '\u043E': 'o', // Cyrillic о
  '\u0440': 'p', // Cyrillic р
  '\u0441': 'c', // Cyrillic с
  '\u0443': 'y', // Cyrillic у
  '\u0445': 'x', // Cyrillic х
  '\u0456': 'i', // Cyrillic і
  '\u0410': 'a', // Cyrillic А
  '\u0415': 'e', // Cyrillic Е
  '\u041E': 'o', // Cyrillic О
  '\u0421': 'c', // Cyrillic С
  '\u0422': 't', // Cyrillic Т
  '\u041D': 'h', // Cyrillic Н
  '\u0412': 'b', // Cyrillic В
  '\u041C': 'm', // Cyrillic М
  '\u041A': 'k', // Cyrillic К
};

// Build combined map at module load (homoglyphs + leetspeak merged)
for (const [k, v] of Object.entries(HOMOGLYPH_MAP)) COMBINED_MAP[k] = v;
for (const [k, v] of Object.entries(LEET_MAP)) COMBINED_MAP[k] = v;

/**
 * Replace homoglyphs and leetspeak in a single pass using the combined map.
 */
function normalizeCombined(text: string): string {
  let result = '';
  for (const char of text) {
    result += COMBINED_MAP[char] ?? char;
  }
  return result;
}

/**
 * Remove common separators placed between letters: s.h.i.t, s-h-i-t, s h i t
 */
function removeSeparators(text: string): string {
  // Pattern: single char followed by separator followed by single char (repeating)
  // Match patterns like "f.u.c.k" or "s h i t" or "f-u-c-k" or "f_u_c_k"
  return text.replace(/(?<=\w)[.\-_\s]+(?=\w)/g, '');
}

/**
 * Collapse repeated characters: shiiiiit → shit, fuuuuck → fuck
 * Only collapse runs of 3+ to avoid breaking words like "book" or "need"
 */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1');
}

/**
 * Replace leetspeak characters with their letter equivalents.
 */
function normalizeLeetspeak(text: string): string {
  let result = '';
  for (const char of text) {
    result += LEET_MAP[char] ?? char;
  }
  return result;
}

/**
 * Replace Unicode homoglyphs (Cyrillic, etc.) with ASCII equivalents.
 */
function normalizeHomoglyphs(text: string): string {
  let result = '';
  for (const char of text) {
    result += HOMOGLYPH_MAP[char] ?? char;
  }
  return result;
}

/**
 * Replace asterisk-masked letters: f**k → fuck, s*** → shit (best-effort)
 * This replaces asterisks with a wildcard marker for the profanity checker.
 */
function normalizeAsterisks(text: string): string {
  // Replace asterisks within words with a generic vowel to increase match chance
  return text.replace(/\*+/g, 'u');
}

/**
 * Full normalization pipeline for profanity detection.
 * Input → lowercase → homoglyphs+leetspeak → asterisks → remove separators → collapse repeats
 *
 * 2.1: Early exit for plain ASCII lowercase words (~95% of words on typical pages).
 */
export function normalize(input: string): string {
  const lower = input.toLowerCase();
  // Fast path: plain ASCII lowercase with no repeated runs needs no normalization
  if (PLAIN_ASCII_RE.test(lower) && !HAS_REPEAT_RUN.test(lower)) return lower;

  // Full pipeline with merged homoglyph+leetspeak pass
  let text = normalizeCombined(lower);
  text = normalizeAsterisks(text);
  text = removeSeparators(text);
  text = collapseRepeats(text);
  return text;
}

/**
 * Normalize a single word only (for matching individual tokens).
 */
export function normalizeWord(word: string): string {
  return normalize(word);
}

export {
  removeSeparators,
  collapseRepeats,
  normalizeLeetspeak,
  normalizeHomoglyphs,
  normalizeAsterisks,
};
