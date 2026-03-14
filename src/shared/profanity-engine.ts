/**
 * Core profanity detection and replacement engine.
 * Uses @2toad/profanity as base with custom leetspeak normalization
 * and funny word replacement.
 */

import { Profanity, ProfanityOptions } from '@2toad/profanity';
import { normalize } from './normalizer';
import { getFunnyWord, matchCase } from './funny-words';
import type { FilterResult, ProfanityMatch, ProfaneUrl, Sensitivity } from './types';

// Import word lists from JSON data files
import SUPPLEMENTARY_WORDS from '../data/profanity-supplementary.json';
import SAFE_WORDS from '../data/profanity-safe.json';
import sensitivityData from '../data/profanity-sensitivity.json';
import profanityContextData from '../data/profanity-context.json';

// Safe context n-grams per profane word — skip match if surrounding text matches
const PROFANITY_SAFE_CONTEXT: Record<string, string[]> = profanityContextData;

// Build profanity checker with all default words
const profanityOptions = new ProfanityOptions({
  wholeWord: true,
  grawlix: '****',
  grawlixChar: '*',
});

const profanity = new Profanity(profanityOptions);

profanity.addWords(SUPPLEMENTARY_WORDS);
profanity.removeWords(SAFE_WORDS);

// Mild-only word list (most offensive — always filtered)
const MILD_WORDS = new Set([
  ...sensitivityData.mild,
]);

// Moderate additions (standard profanity)
const MODERATE_WORDS = new Set([
  ...MILD_WORDS,
  ...sensitivityData.moderate,
]);

// Custom words bypass the sensitivity gate — always filtered at any level
const CUSTOM_BLOCKED_WORDS = new Set<string>();

// Track custom safe words so they can be undone on reset
const CUSTOM_SAFE_WORDS = new Set<string>();

// URL / email / code pattern to skip
const URL_PATTERN = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi;
const CODE_PATTERN = /`[^`]+`/g;

/**
 * Add custom blocked words at runtime (user custom words).
 * These bypass sensitivity — always filtered at any level.
 * Additive — used by word-list-updater for remote delta updates.
 */
export function addCustomProfanity(words: string[]): void {
  profanity.addWords(words);
  for (const w of words) {
    CUSTOM_BLOCKED_WORDS.add(w.toLowerCase());
  }
}

/**
 * Set (replace) custom blocked words. Clears previously added custom words
 * before adding the new list, so removed words stop being detected.
 */
export function setCustomProfanity(words: string[]): void {
  if (CUSTOM_BLOCKED_WORDS.size > 0) {
    profanity.removeWords([...CUSTOM_BLOCKED_WORDS]);
    CUSTOM_BLOCKED_WORDS.clear();
  }
  if (words.length > 0) {
    profanity.addWords(words);
    for (const w of words) {
      CUSTOM_BLOCKED_WORDS.add(w.toLowerCase());
    }
  }
}

/**
 * Add custom safe words at runtime (user false-positive overrides).
 * Additive — used by word-list-updater for remote delta updates.
 */
export function addCustomSafeWords(words: string[]): void {
  profanity.removeWords(words);
}

/**
 * Set (replace) custom safe words. Re-adds previously safe-listed words
 * back to the profanity dictionary, then removes the new list.
 */
export function setCustomSafeWords(words: string[]): void {
  if (CUSTOM_SAFE_WORDS.size > 0) {
    profanity.addWords([...CUSTOM_SAFE_WORDS]);
    CUSTOM_SAFE_WORDS.clear();
  }
  if (words.length > 0) {
    profanity.removeWords(words);
    for (const w of words) {
      CUSTOM_SAFE_WORDS.add(w.toLowerCase());
    }
  }
}

/**
 * Check if a word is profane at the given sensitivity level.
 */
function isProfaneAtSensitivity(word: string, sensitivity: Sensitivity): boolean {
  const normalized = normalize(word);

  // Check with the @2toad/profanity library
  const isProfane = profanity.exists(word) || profanity.exists(normalized);
  if (!isProfane) return false;

  // Custom blocked words bypass sensitivity — always filtered
  const lowerWord = word.toLowerCase();
  const lowerNormalized = normalized.toLowerCase();
  if (CUSTOM_BLOCKED_WORDS.has(lowerWord) || CUSTOM_BLOCKED_WORDS.has(lowerNormalized)) {
    return true;
  }

  // For strict: everything the engine catches
  if (sensitivity === 'strict') return true;

  // For moderate/mild: check against the appropriate word set
  const wordSet = sensitivity === 'mild' ? MILD_WORDS : MODERATE_WORDS;

  // Check if the normalized word (or a root form) is in the set
  for (const profaneWord of wordSet) {
    if (lowerNormalized === profaneWord || lowerNormalized.includes(profaneWord)) {
      return true;
    }
  }

  // Also check original word
  for (const profaneWord of wordSet) {
    if (lowerWord === profaneWord || lowerWord.includes(profaneWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract a context window around a match position in the text.
 * Returns surrounding words (2 before + matched word + 2 after) as a lowercase string.
 */
function getContextWindow(text: string, matchIndex: number, matchLength: number): string {
  const before = text.slice(Math.max(0, matchIndex - 50), matchIndex);
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 50);

  const wordsBefore = before.split(/\s+/).filter(Boolean).slice(-2);
  const wordsAfter = after.split(/\s+/).filter(Boolean).slice(0, 2);
  const matchWord = text.slice(matchIndex, matchIndex + matchLength);

  return [...wordsBefore, matchWord, ...wordsAfter].join(' ').toLowerCase();
}

/**
 * Check if a profane word appears in a safe context.
 * For example, "dam" in "beaver dam" should not be flagged.
 */
export function isInSafeProfanityContext(word: string, contextWindow: string): boolean {
  const lowerWord = word.toLowerCase();
  const safeContexts = PROFANITY_SAFE_CONTEXT[lowerWord];
  if (!safeContexts || safeContexts.length === 0) return false;

  const lowerContext = contextWindow.toLowerCase();
  return safeContexts.some((ctx) => lowerContext.includes(ctx));
}

/**
 * Detect profanity in text, returning all matches with positions.
 */
export function detectProfanity(
  text: string,
  sensitivity: Sensitivity = 'moderate',
): ProfanityMatch[] {
  const matches: ProfanityMatch[] = [];

  // Extract URLs and code blocks — mark their positions to skip
  const skipRanges: Array<{ start: number; end: number }> = [];
  for (const pattern of [URL_PATTERN, CODE_PATTERN]) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      skipRanges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Split text into words and check each
  const wordPattern = /\b[\w@$!|*]+\b/g;
  let wordMatch;
  wordPattern.lastIndex = 0;

  while ((wordMatch = wordPattern.exec(text)) !== null) {
    const word = wordMatch[0];
    const index = wordMatch.index;

    // Skip if inside a URL or code block
    const inSkipRange = skipRanges.some(
      (range) => index >= range.start && index < range.end,
    );
    if (inSkipRange) continue;

    if (isProfaneAtSensitivity(word, sensitivity)) {
      // Check surrounding context — skip if the word appears in a safe phrase
      const contextWindow = getContextWindow(text, index, word.length);
      if (isInSafeProfanityContext(word, contextWindow)) {
        continue;
      }

      const funnyWord = matchCase(getFunnyWord(word), word);
      matches.push({
        original: word,
        replacement: funnyWord,
        index,
      });
    }
  }

  return matches;
}

/**
 * Check if a URL segment contains profane words (substring match for URLs).
 */
function segmentContainsProfanity(segment: string, sensitivity: Sensitivity): boolean {
  const lower = normalize(segment).toLowerCase();
  const wordSet = sensitivity === 'strict' ? MODERATE_WORDS
    : sensitivity === 'mild' ? MILD_WORDS
    : MODERATE_WORDS;

  for (const profaneWord of wordSet) {
    if (lower.includes(profaneWord)) return true;
  }
  return false;
}

/**
 * Check URLs in text for profanity. Returns profane URLs found.
 */
function detectProfaneUrls(
  text: string,
  sensitivity: Sensitivity,
): ProfaneUrl[] {
  const profaneUrls: ProfaneUrl[] = [];
  URL_PATTERN.lastIndex = 0;
  let match;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = match[0];
    // Check the path portion for profane substrings
    const pathPart = url.replace(/^https?:\/\/[^/]*/, '');
    const segments = pathPart.split(/[/\-_.?&#=]+/).filter(Boolean);
    const hasProfane = segments.some((seg) => segmentContainsProfanity(seg, sensitivity));
    if (hasProfane) {
      profaneUrls.push({ url, index: match.index, length: url.length });
    }
  }
  return profaneUrls;
}

/**
 * Replace all profanity in text with funny alternatives.
 */
export function replaceProfanity(
  text: string,
  sensitivity: Sensitivity = 'moderate',
): FilterResult {
  const matches = detectProfanity(text, sensitivity);
  const profaneUrls = detectProfaneUrls(text, sensitivity);

  if (matches.length === 0 && profaneUrls.length === 0) {
    return {
      original: text,
      filtered: text,
      replacements: [],
      profaneUrls: [],
      hasProfanity: false,
    };
  }

  // Collect all replacements: word matches + profane URL replacements
  // Build a unified list of ranges to replace (from end to start)
  interface Replacement {
    index: number;
    length: number;
    replacement: string;
  }
  const allReplacements: Replacement[] = [];

  for (const m of matches) {
    allReplacements.push({ index: m.index, length: m.original.length, replacement: m.replacement });
  }
  for (const u of profaneUrls) {
    allReplacements.push({ index: u.index, length: u.length, replacement: '[link]' });
  }

  // Sort by index descending to replace from end to start
  allReplacements.sort((a, b) => b.index - a.index);

  let filtered = text;
  for (const r of allReplacements) {
    filtered =
      filtered.slice(0, r.index) +
      r.replacement +
      filtered.slice(r.index + r.length);
  }

  return {
    original: text,
    filtered,
    replacements: matches,
    profaneUrls,
    hasProfanity: true,
  };
}

/**
 * Quick check if text contains any profanity.
 */
export function containsProfanity(
  text: string,
  sensitivity: Sensitivity = 'moderate',
): boolean {
  return detectProfanity(text, sensitivity).length > 0;
}
