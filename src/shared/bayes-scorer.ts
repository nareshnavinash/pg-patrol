/**
 * Naive Bayes text toxicity scorer.
 *
 * Uses pre-computed word log-probabilities to classify text as toxic or safe.
 * The model JSON contains log-probabilities for each word given class
 * (P(word|toxic) and P(word|safe)), plus class priors.
 *
 * Returns a toxicity probability between 0 and 1.
 */

import bayesModel from '../data/bayes-model.json';

export interface BayesResult {
  toxicityProb: number;
  logToxic: number;
  logSafe: number;
}

const toxicWords: Record<string, number> = bayesModel.toxic;
const safeWords: Record<string, number> = bayesModel.safe;
const priorToxic: number = bayesModel.priorToxic;
const priorSafe: number = bayesModel.priorSafe;
const defaultToxic: number = bayesModel.defaultToxic;
const defaultSafe: number = bayesModel.defaultSafe;

/**
 * Tokenize text into lowercase words, stripping punctuation.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Score text for toxicity using Naive Bayes.
 *
 * Computes log P(toxic|words) and log P(safe|words) using Bayes' theorem
 * with bag-of-words assumption, then converts to probability via log-sum-exp.
 */
export function scoreBayes(text: string): BayesResult {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return { toxicityProb: 0, logToxic: -Infinity, logSafe: 0 };
  }

  let logToxic = priorToxic;
  let logSafe = priorSafe;

  for (const token of tokens) {
    logToxic += toxicWords[token] ?? defaultToxic;
    logSafe += safeWords[token] ?? defaultSafe;
  }

  // Log-sum-exp to convert to probability: P(toxic|text) = exp(logToxic) / (exp(logToxic) + exp(logSafe))
  const maxLog = Math.max(logToxic, logSafe);
  const toxicityProb =
    Math.exp(logToxic - maxLog) /
    (Math.exp(logToxic - maxLog) + Math.exp(logSafe - maxLog));

  return {
    toxicityProb,
    logToxic,
    logSafe,
  };
}
