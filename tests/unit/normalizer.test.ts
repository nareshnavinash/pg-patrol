import {
  normalize,
  normalizeWord,
  removeSeparators,
  collapseRepeats,
  normalizeLeetspeak,
  normalizeHomoglyphs,
  normalizeAsterisks,
} from '../../src/shared/normalizer';

describe('normalizer', () => {
  describe('normalizeLeetspeak', () => {
    it('converts common number substitutions', () => {
      expect(normalizeLeetspeak('4')).toBe('a');
      expect(normalizeLeetspeak('3')).toBe('e');
      expect(normalizeLeetspeak('1')).toBe('i');
      expect(normalizeLeetspeak('0')).toBe('o');
      expect(normalizeLeetspeak('5')).toBe('s');
      expect(normalizeLeetspeak('7')).toBe('t');
      expect(normalizeLeetspeak('8')).toBe('b');
    });

    it('converts symbol substitutions', () => {
      expect(normalizeLeetspeak('@')).toBe('a');
      expect(normalizeLeetspeak('$')).toBe('s');
      expect(normalizeLeetspeak('!')).toBe('i');
      expect(normalizeLeetspeak('|')).toBe('l');
      expect(normalizeLeetspeak('+')).toBe('t');
    });

    it('converts full leetspeak words', () => {
      expect(normalizeLeetspeak('$h!7')).toBe('shit');
      expect(normalizeLeetspeak('4$$')).toBe('ass');
      expect(normalizeLeetspeak('81+ch')).toBe('bitch');
    });

    it('leaves normal text unchanged', () => {
      expect(normalizeLeetspeak('hello')).toBe('hello');
      expect(normalizeLeetspeak('world')).toBe('world');
    });
  });

  describe('normalizeHomoglyphs', () => {
    it('converts Cyrillic characters that look like Latin', () => {
      expect(normalizeHomoglyphs('\u0430')).toBe('a'); // Cyrillic а
      expect(normalizeHomoglyphs('\u0435')).toBe('e'); // Cyrillic е
      expect(normalizeHomoglyphs('\u043E')).toBe('o'); // Cyrillic о
      expect(normalizeHomoglyphs('\u0441')).toBe('c'); // Cyrillic с
    });

    it('leaves standard ASCII unchanged', () => {
      expect(normalizeHomoglyphs('abc')).toBe('abc');
    });
  });

  describe('removeSeparators', () => {
    it('removes dots between single characters', () => {
      expect(removeSeparators('s.h.i.t')).toBe('shit');
    });

    it('removes dashes between single characters', () => {
      expect(removeSeparators('f-u-c-k')).toBe('fuck');
    });

    it('removes spaces between single characters', () => {
      expect(removeSeparators('s h i t')).toBe('shit');
    });

    it('removes underscores between single characters', () => {
      expect(removeSeparators('f_u_c_k')).toBe('fuck');
    });

    it('does not break normal sentences', () => {
      expect(removeSeparators('hello world today')).toBe('helloworldtoday');
    });
  });

  describe('collapseRepeats', () => {
    it('collapses 3+ repeated characters', () => {
      expect(collapseRepeats('shiiiiit')).toBe('shit');
      expect(collapseRepeats('fuuuuuck')).toBe('fuck');
      expect(collapseRepeats('assssss')).toBe('as');
    });

    it('preserves double letters', () => {
      expect(collapseRepeats('book')).toBe('book');
      expect(collapseRepeats('need')).toBe('need');
      expect(collapseRepeats('bass')).toBe('bass');
    });
  });

  describe('normalizeAsterisks', () => {
    it('replaces asterisk runs with single u', () => {
      expect(normalizeAsterisks('f**k')).toBe('fuk');
      expect(normalizeAsterisks('s***')).toBe('su');
      expect(normalizeAsterisks('f*ck')).toBe('fuck');
    });
  });

  describe('normalize (full pipeline)', () => {
    it('normalizes leetspeak profanity', () => {
      expect(normalize('$h!7')).toBe('shit');
      expect(normalize('4$$')).toBe('ass');
      expect(normalize('F*CK')).toBe('fuck');
    });

    it('normalizes separated profanity', () => {
      expect(normalize('s.h.i.t')).toBe('shit');
      expect(normalize('f-u-c-k')).toBe('fuck');
    });

    it('normalizes repeated characters', () => {
      expect(normalize('SHIIIIIT')).toBe('shit');
      expect(normalize('fuuuuuck')).toBe('fuck');
    });

    it('normalizes asterisk-masked words', () => {
      expect(normalize('f**k')).toBe('fuk');
    });

    it('handles combined obfuscation', () => {
      const result = normalize('$H!!!!T');
      expect(result).toBe('shit');
    });

    it('leaves clean text mostly intact', () => {
      expect(normalize('hello')).toBe('hello');
      expect(normalize('WORLD')).toBe('world');
    });
  });

  describe('normalizeWord', () => {
    it('normalizes a single word', () => {
      expect(normalizeWord('$h!7')).toBe('shit');
    });
  });
});
