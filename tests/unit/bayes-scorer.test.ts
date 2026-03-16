import { scoreBayes, tokenize } from '../../src/shared/bayes-scorer';

describe('bayes-scorer', () => {
  describe('tokenize', () => {
    it('lowercases and splits on whitespace', () => {
      expect(tokenize('Hello World')).toEqual(['hello', 'world']);
    });

    it('strips punctuation', () => {
      expect(tokenize('Hello, World! How are you?')).toEqual([
        'hello',
        'world',
        'how',
        'are',
        'you',
      ]);
    });

    it('filters out single-character tokens', () => {
      expect(tokenize('I am a dog')).toEqual(['am', 'dog']);
    });

    it('returns empty array for empty input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   ')).toEqual([]);
    });

    it('preserves hyphens and apostrophes within words', () => {
      const tokens = tokenize("it's a well-known fact");
      expect(tokens).toContain("it's");
      expect(tokens).toContain('well-known');
    });
  });

  describe('scoreBayes', () => {
    it('returns toxicityProb between 0 and 1', () => {
      const result = scoreBayes('This is a normal sentence about the weather today.');
      expect(result.toxicityProb).toBeGreaterThanOrEqual(0);
      expect(result.toxicityProb).toBeLessThanOrEqual(1);
    });

    it('returns 0 toxicity for empty text', () => {
      expect(scoreBayes('').toxicityProb).toBe(0);
      expect(scoreBayes('   ').toxicityProb).toBe(0);
    });

    it('scores toxic text higher than safe text', () => {
      const toxic = scoreBayes('You are stupid and worthless and nobody cares about you.');
      const safe = scoreBayes('You are wonderful and everyone loves and appreciates you.');
      expect(toxic.toxicityProb).toBeGreaterThan(safe.toxicityProb);
    });

    it('scores direct insults as high toxicity', () => {
      const result = scoreBayes('You are an idiot and a moron. You are pathetic and useless.');
      expect(result.toxicityProb).toBeGreaterThan(0.5);
    });

    it('scores kind text as low toxicity', () => {
      const result = scoreBayes(
        'Thank you so much for your help. You are very kind and wonderful.',
      );
      expect(result.toxicityProb).toBeLessThan(0.3);
    });

    it('scores hate speech indicators as high toxicity', () => {
      const result = scoreBayes('Racist bigotry and discrimination are evil and cruel.');
      expect(result.toxicityProb).toBeGreaterThan(0.5);
    });

    it('scores harassment language as high toxicity', () => {
      const result = scoreBayes('You are trash. Nobody likes you. You are a failure and a loser.');
      expect(result.toxicityProb).toBeGreaterThan(0.5);
    });

    it('scores neutral/everyday text as low toxicity', () => {
      const result = scoreBayes(
        'The team is working on a new design for the website. The project is going well.',
      );
      expect(result.toxicityProb).toBeLessThan(0.3);
    });

    it('scores food/cooking text as low toxicity', () => {
      const result = scoreBayes(
        'This delicious recipe for cooking pasta is amazing. The food was wonderful.',
      );
      expect(result.toxicityProb).toBeLessThan(0.3);
    });

    it('scores violence words as higher than neutral words', () => {
      const violent = scoreBayes('murder killing violence attack assault brutality');
      const neutral = scoreBayes('garden flowers sunshine nature beauty peaceful');
      expect(violent.toxicityProb).toBeGreaterThan(neutral.toxicityProb);
    });

    it('returns logToxic and logSafe values', () => {
      const result = scoreBayes('This is a test sentence.');
      expect(typeof result.logToxic).toBe('number');
      expect(typeof result.logSafe).toBe('number');
      expect(result.logToxic).not.toBe(Infinity);
      expect(result.logSafe).not.toBe(Infinity);
    });

    it('handles text with unknown words gracefully', () => {
      const result = scoreBayes('xyzzy quux zaphod beeblebrox trillian');
      expect(result.toxicityProb).toBeGreaterThanOrEqual(0);
      expect(result.toxicityProb).toBeLessThanOrEqual(1);
    });

    it('implicit toxicity without explicit trigger words scores higher', () => {
      // "you're worthless and nobody cares" — the key use case for Bayes
      const implicit = scoreBayes('You are worthless and nobody cares about you.');
      expect(implicit.toxicityProb).toBeGreaterThan(0.3);
    });
  });
});
