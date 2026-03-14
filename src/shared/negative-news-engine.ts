/**
 * Negative news content detection engine for Good Vibes Mode.
 * Scores blocks of text for negativity using keyword matching
 * with safe-context dampening, n-gram context analysis, and negation detection.
 */

import type { NegativeContentResult, NegativeContentMatch } from './types';
import {
  TRIGGER_WORDS,
  TRIGGER_PHRASES,
  TRIGGER_CATEGORIES,
  PHRASE_CATEGORIES,
  AMPLIFIER_WORDS,
  SAFE_CONTEXT_WORDS,
} from './negative-news-words';
import safeNgrams from '../data/safe-ngrams.json';
import { scoreBayes } from './bayes-scorer';

// Skip URLs and code blocks (reuses same patterns as profanity-engine)
const URL_PATTERN = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi;
const CODE_PATTERN = /`[^`]+`/g;

// Negation words — when found before a trigger, suppress the trigger
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'none', 'neither', 'nor',
  "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't",
  "won't", "wouldn't", "couldn't", "shouldn't", "hasn't", "haven't", "hadn't",
  // Contracted forms without apostrophe (common in normalized text)
  'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt',
  'wont', 'wouldnt', 'couldnt', 'shouldnt', 'hasnt', 'havent', 'hadnt',
  'hardly', 'barely', 'without', 'zero',
]);

// Max number of tokens to look back for negation
const NEGATION_WINDOW = 3;

// Safe n-grams per trigger word (loaded from JSON)
const SAFE_NGRAM_MAP: Record<string, string[]> = safeNgrams;

/**
 * Strip URLs and code blocks from text before scoring.
 */
function stripSkippedRanges(text: string): string {
  return text.replace(URL_PATTERN, ' ').replace(CODE_PATTERN, ' ');
}

/**
 * Extract a context window of words around a position in the text.
 * Returns the surrounding text (windowSize words before and after).
 */
function getContextWindow(text: string, matchIndex: number, matchLength: number, windowSize: number = 3): string {
  // Get text before the match
  const before = text.slice(Math.max(0, matchIndex - 80), matchIndex);
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 80);

  const wordsBefore = before.split(/\s+/).filter(Boolean).slice(-windowSize);
  const wordsAfter = after.split(/\s+/).filter(Boolean).slice(0, windowSize);
  const matchWord = text.slice(matchIndex, matchIndex + matchLength);

  return [...wordsBefore, matchWord, ...wordsAfter].join(' ').toLowerCase();
}

/**
 * Check if a trigger word appears in a safe n-gram context.
 */
export function isInSafeNgram(triggerWord: string, contextWindow: string): boolean {
  const safeNgramList = SAFE_NGRAM_MAP[triggerWord];
  if (!safeNgramList) return false;

  const lowerContext = contextWindow.toLowerCase();
  return safeNgramList.some((ngram) => lowerContext.includes(ngram));
}

/**
 * Check if a trigger word is preceded by a negation word within N tokens.
 */
export function isPrecededByNegation(text: string, matchIndex: number): boolean {
  // Get the text before the match
  const before = text.slice(Math.max(0, matchIndex - 60), matchIndex);
  const tokens = before.split(/\s+/).filter(Boolean).slice(-NEGATION_WINDOW);

  return tokens.some((token) => NEGATION_WORDS.has(token.toLowerCase()));
}

/**
 * Score a block of text for negative news content.
 */
export function scoreText(text: string): NegativeContentResult {
  if (!text || text.trim().length === 0) {
    return { isNegative: false, score: 0, matches: [] };
  }

  const cleaned = stripSkippedRanges(text);
  const lower = cleaned.toLowerCase();
  const matches: NegativeContentMatch[] = [];

  // Track which character positions are already matched (by phrases)
  const matchedRanges: Array<{ start: number; end: number }> = [];

  // Phase 1: Match multi-word phrases first (longest match wins)
  const sortedPhrases = [...TRIGGER_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(phrase, searchFrom);
      if (idx === -1) break;

      // Check this range isn't already covered
      const alreadyCovered = matchedRanges.some(
        (r) => idx >= r.start && idx < r.end,
      );
      if (!alreadyCovered) {
        matches.push({
          phrase,
          index: idx,
          length: phrase.length,
          category: PHRASE_CATEGORIES[phrase] ?? 'general',
        });
        matchedRanges.push({ start: idx, end: idx + phrase.length });
      }
      searchFrom = idx + 1;
    }
  }

  // Phase 2: Tokenize and match individual trigger words
  const words = lower.split(/\W+/).filter(Boolean);
  let triggerCount = matches.length; // phrases already counted
  let triggersEncountered = matches.length; // total triggers seen (including suppressed)
  let amplifierCount = 0;
  let safeContextCount = 0;

  // For single-word matching, we need to find positions in the original text
  const wordPattern = /\b[a-z]+(?:-[a-z]+)*\b/gi;
  let wordMatch;
  wordPattern.lastIndex = 0;

  while ((wordMatch = wordPattern.exec(lower)) !== null) {
    const word = wordMatch[0];
    const idx = wordMatch.index;

    // Skip if inside an already-matched phrase range
    const inRange = matchedRanges.some(
      (r) => idx >= r.start && idx + word.length <= r.end,
    );
    if (inRange) continue;

    if (TRIGGER_WORDS.has(word)) {
      triggersEncountered++;

      // Check safe n-gram context — skip trigger if it appears in a safe phrase
      const contextWindow = getContextWindow(lower, idx, word.length);
      if (isInSafeNgram(word, contextWindow)) {
        continue;
      }

      // Check negation — skip trigger if preceded by negation
      if (isPrecededByNegation(lower, idx)) {
        continue;
      }

      triggerCount++;
      matches.push({
        phrase: word,
        index: idx,
        length: word.length,
        category: TRIGGER_CATEGORIES[word] ?? 'general',
      });
    }

    if (AMPLIFIER_WORDS.has(word)) {
      amplifierCount++;
    }

    if (SAFE_CONTEXT_WORDS.has(word)) {
      safeContextCount++;
    }
  }

  // Also check multi-word safe context phrases (e.g., "star wars")
  for (const safePhrase of SAFE_CONTEXT_WORDS) {
    if (safePhrase.includes(' ') && lower.includes(safePhrase)) {
      safeContextCount += 2; // Extra weight for explicit safe phrases
    }
  }

  const totalWords = words.length || 1;

  // Keyword score: (triggers + amplifiers * 0.5) / totalWords, dampened by safe context
  const rawScore = (triggerCount + amplifierCount * 0.5) / totalWords;
  const keywordScore = rawScore / (1 + safeContextCount);

  // Bayesian toxicity scorer fills the gap when no trigger words exist at all.
  // When triggers were found (even if suppressed by n-grams/negation), trust the keyword engine.
  // When no triggers exist, Bayes catches implicit toxicity like "you're worthless".
  let score: number;
  if (triggersEncountered === 0) {
    const bayesResult = scoreBayes(cleaned);
    // Ensemble: keyword score (likely 0) + Bayes contribution
    // Scale Bayes probability to match the keyword score range
    score = keywordScore + bayesResult.toxicityProb * 0.04;
  } else {
    score = keywordScore;
  }

  return {
    isNegative: score > 0.03,
    score,
    matches,
  };
}

/**
 * Quick check if text is negative content.
 */
export function isNegativeContent(text: string): boolean {
  return scoreText(text).isNegative;
}
