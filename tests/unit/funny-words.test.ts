import { getFunnyWord, getFunnyWordSeeded, matchCase } from '../../src/shared/funny-words';

describe('funny-words', () => {
  describe('getFunnyWord', () => {
    it('returns a word starting with f for f-words', () => {
      const word = getFunnyWord('fuck');
      expect(word.charAt(0)).toBe('f');
    });

    it('returns a word starting with s for s-words', () => {
      const word = getFunnyWord('shit');
      expect(word.charAt(0)).toBe('s');
    });

    it('returns a word starting with a for a-words', () => {
      const word = getFunnyWord('ass');
      expect(word.charAt(0)).toBe('a');
    });

    it('returns a word starting with b for b-words', () => {
      const word = getFunnyWord('bitch');
      expect(word.charAt(0)).toBe('b');
    });

    it('returns a word starting with d for d-words', () => {
      const word = getFunnyWord('damn');
      expect(word.charAt(0)).toBe('d');
    });

    it('returns a fallback for unknown starting letters', () => {
      // getFunnyWord should still return something for any input
      const word = getFunnyWord('zzzzz');
      expect(word).toBeTruthy();
      expect(typeof word).toBe('string');
    });
  });

  describe('getFunnyWordSeeded', () => {
    it('returns the same word for the same seed', () => {
      const word1 = getFunnyWordSeeded('fuck', 0);
      const word2 = getFunnyWordSeeded('fuck', 0);
      expect(word1).toBe(word2);
    });

    it('returns different words for different seeds', () => {
      const word1 = getFunnyWordSeeded('fuck', 0);
      const word2 = getFunnyWordSeeded('fuck', 1);
      // With at least 3 f-words, seeds 0 and 1 should give different results
      expect(word1).not.toBe(word2);
    });

    it('starts with the correct letter', () => {
      const word = getFunnyWordSeeded('shit', 3);
      expect(word.charAt(0)).toBe('s');
    });
  });

  describe('matchCase', () => {
    it('preserves lowercase', () => {
      expect(matchCase('fiddlesticks', 'fuck')).toBe('fiddlesticks');
    });

    it('preserves ALL CAPS', () => {
      expect(matchCase('fiddlesticks', 'FUCK')).toBe('FIDDLESTICKS');
    });

    it('preserves Title Case', () => {
      expect(matchCase('fiddlesticks', 'Fuck')).toBe('Fiddlesticks');
    });

    it('does not uppercase single-char words that happen to be uppercase', () => {
      // Single char uppercase check — "F" has length 1, no all-caps conversion
      expect(matchCase('fudge', 'f')).toBe('fudge');
    });
  });
});
