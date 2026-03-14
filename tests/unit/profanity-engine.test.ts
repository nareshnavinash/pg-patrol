import {
  detectProfanity,
  replaceProfanity,
  containsProfanity,
  isInSafeProfanityContext,
} from '../../src/shared/profanity-engine';

describe('profanity-engine', () => {
  describe('containsProfanity', () => {
    it('detects basic profanity', () => {
      expect(containsProfanity('what the fuck')).toBe(true);
      expect(containsProfanity('this is shit')).toBe(true);
      expect(containsProfanity('you bitch')).toBe(true);
    });

    it('returns false for clean text', () => {
      expect(containsProfanity('hello world')).toBe(false);
      expect(containsProfanity('have a nice day')).toBe(false);
      expect(containsProfanity('the weather is great')).toBe(false);
    });

    it('returns false for empty text', () => {
      expect(containsProfanity('')).toBe(false);
    });
  });

  describe('detectProfanity', () => {
    it('returns matches with positions', () => {
      const matches = detectProfanity('what the fuck is this shit');
      expect(matches.length).toBeGreaterThanOrEqual(2);

      const fMatch = matches.find((m) => m.original === 'fuck');
      expect(fMatch).toBeDefined();
      expect(fMatch!.index).toBe(9);
      expect(fMatch!.replacement).toBeTruthy();

      const sMatch = matches.find((m) => m.original === 'shit');
      expect(sMatch).toBeDefined();
      expect(sMatch!.replacement).toBeTruthy();
    });

    it('detects profanity with different sensitivity levels', () => {
      // 'crap' should be caught in strict but maybe not mild
      const strictMatches = detectProfanity('this is crap', 'strict');
      const mildMatches = detectProfanity('this is crap', 'mild');

      expect(strictMatches.length).toBeGreaterThanOrEqual(mildMatches.length);
    });

    it('skips URLs', () => {
      const matches = detectProfanity('check https://example.com/shitpost for details');
      const urlMatch = matches.find(
        (m) => m.index > 5 && m.index < 40,
      );
      // The word inside the URL should be skipped
      expect(urlMatch).toBeUndefined();
    });

    it('skips code blocks', () => {
      const matches = detectProfanity('run the command `git push --force-with-lease`');
      expect(matches.length).toBe(0);
    });
  });

  describe('replaceProfanity', () => {
    it('replaces profanity with funny words', () => {
      const result = replaceProfanity('what the fuck');
      expect(result.hasProfanity).toBe(true);
      expect(result.filtered).not.toContain('fuck');
      expect(result.replacements.length).toBeGreaterThan(0);
      expect(result.original).toBe('what the fuck');
    });

    it('returns original text when no profanity found', () => {
      const result = replaceProfanity('hello beautiful world');
      expect(result.hasProfanity).toBe(false);
      expect(result.filtered).toBe('hello beautiful world');
      expect(result.replacements).toHaveLength(0);
    });

    it('handles multiple profane words', () => {
      const result = replaceProfanity('fuck this shit');
      expect(result.hasProfanity).toBe(true);
      expect(result.replacements.length).toBeGreaterThanOrEqual(2);
      expect(result.filtered).not.toContain('fuck');
      expect(result.filtered).not.toContain('shit');
    });

    it('preserves text structure around replacements', () => {
      const result = replaceProfanity('I said what the fuck to him');
      expect(result.filtered).toMatch(/^I said what the .+ to him$/);
    });
  });

  describe('Scunthorpe problem (false positives)', () => {
    it('does NOT flag "assassin"', () => {
      expect(containsProfanity('the assassin struck')).toBe(false);
    });

    it('does NOT flag "class"', () => {
      expect(containsProfanity('a first class ticket')).toBe(false);
    });

    it('does NOT flag "classic"', () => {
      expect(containsProfanity('a classic movie')).toBe(false);
    });

    it('does NOT flag "cocktail"', () => {
      expect(containsProfanity('a delicious cocktail')).toBe(false);
    });

    it('does NOT flag "assume"', () => {
      expect(containsProfanity('I assume so')).toBe(false);
    });

    it('does NOT flag "bass"', () => {
      expect(containsProfanity('play the bass guitar')).toBe(false);
    });

    it('does NOT flag "therapist"', () => {
      expect(containsProfanity('see a therapist')).toBe(false);
    });

    it('does NOT flag "butterfly"', () => {
      expect(containsProfanity('a beautiful butterfly')).toBe(false);
    });

    it('does NOT flag "title"', () => {
      expect(containsProfanity('the title of the book')).toBe(false);
    });

    it('does NOT flag "analyst"', () => {
      expect(containsProfanity('the data analyst')).toBe(false);
    });
  });

  describe('profane URL detection', () => {
    it('identifies URLs containing profanity', () => {
      const result = replaceProfanity('check https://example.com/shitpost for details');
      expect(result.profaneUrls.length).toBe(1);
      expect(result.filtered).toContain('[link]');
      expect(result.filtered).not.toContain('https://example.com/shitpost');
    });

    it('leaves clean URLs untouched', () => {
      const result = replaceProfanity('visit https://example.com/blog for news');
      expect(result.profaneUrls.length).toBe(0);
      expect(result.filtered).toContain('https://example.com/blog');
    });

    it('handles multiple profane URLs', () => {
      const result = replaceProfanity(
        'see https://example.com/shitpost and https://other.com/fuck-this too',
      );
      expect(result.profaneUrls.length).toBe(2);
      expect(result.filtered.match(/\[link\]/g)?.length).toBe(2);
    });

    it('handles profane URL alongside text profanity', () => {
      const result = replaceProfanity(
        'holy shit check https://example.com/shitpost now',
      );
      expect(result.profaneUrls.length).toBe(1);
      expect(result.replacements.length).toBeGreaterThan(0);
      expect(result.filtered).toContain('[link]');
      expect(result.filtered).not.toContain('shit');
    });

    it('returns empty profaneUrls when no profanity found', () => {
      const result = replaceProfanity('hello world');
      expect(result.profaneUrls).toEqual([]);
    });
  });

  describe('context-aware profanity (safe context window)', () => {
    it('does NOT flag "damn" in "damn good job"', () => {
      expect(containsProfanity('That was a damn good job on the project', 'moderate')).toBe(false);
    });

    it('does NOT flag "damn" in "damn right"', () => {
      expect(containsProfanity('You are damn right about that', 'moderate')).toBe(false);
    });

    it('does NOT flag "damn" in "damn straight"', () => {
      expect(containsProfanity('He was damn straight with his response', 'moderate')).toBe(false);
    });

    it('does NOT flag "dick" in "Dick Tracy"', () => {
      expect(containsProfanity('Have you read the Dick Tracy comic strip', 'moderate')).toBe(false);
    });

    it('does NOT flag "dick" in "Moby Dick"', () => {
      expect(containsProfanity('We are reading Moby Dick in literature class', 'moderate')).toBe(false);
    });

    it('does NOT flag "dick" in "spotted dick"', () => {
      expect(containsProfanity('We had spotted dick for dessert tonight', 'moderate')).toBe(false);
    });

    it('does NOT flag "cock" in "shuttlecock"', () => {
      expect(containsProfanity('Hit the shuttlecock over the net', 'moderate')).toBe(false);
    });

    it('does NOT flag "cock" in "weathercock"', () => {
      expect(containsProfanity('The weathercock on the barn spun in the wind', 'moderate')).toBe(false);
    });

    it('does NOT flag "prick" in "prick your finger"', () => {
      expect(containsProfanity('Be careful not to prick your finger on that needle', 'moderate')).toBe(false);
    });

    it('does NOT flag "prick" in "pinprick"', () => {
      expect(containsProfanity('It was just a pinprick on his arm', 'moderate')).toBe(false);
    });

    it('does NOT flag "pussy" in "pussycat"', () => {
      const matches = detectProfanity('The pussycat sat on the warm windowsill', 'moderate');
      const pussyMatch = matches.find((m) => m.original.toLowerCase() === 'pussy');
      expect(pussyMatch).toBeUndefined();
    });

    it('does NOT flag "pussy" in "pussy willow"', () => {
      expect(containsProfanity('We found pussy willow branches by the creek', 'moderate')).toBe(false);
    });

    it('does NOT flag "balls" in "tennis balls" at strict', () => {
      expect(containsProfanity('We bought new tennis balls for practice', 'strict')).toBe(false);
    });

    it('does NOT flag "balls" in "golf balls" at strict', () => {
      expect(containsProfanity('He lost three golf balls in the lake', 'strict')).toBe(false);
    });

    it('does NOT flag "knob" in "door knob" at strict', () => {
      expect(containsProfanity('Turn the door knob to open it', 'strict')).toBe(false);
    });

    it('does NOT flag "knob" in "volume knob" at strict', () => {
      expect(containsProfanity('Adjust the volume knob on the radio', 'strict')).toBe(false);
    });

    it('does NOT flag "tit" in "blue tit" at strict', () => {
      expect(containsProfanity('A blue tit landed on the feeder', 'strict')).toBe(false);
    });

    it('does NOT flag "tit" in "tit for tat" at strict', () => {
      expect(containsProfanity('It was a tit for tat exchange', 'strict')).toBe(false);
    });

    it('still flags actual profanity — "damn you"', () => {
      expect(containsProfanity('damn you for doing that', 'moderate')).toBe(true);
    });

    it('still flags actual profanity — "what a dick"', () => {
      expect(containsProfanity('what a dick move that was', 'moderate')).toBe(true);
    });

    it('still flags actual profanity — "you prick"', () => {
      expect(containsProfanity('you absolute prick why did you do that', 'moderate')).toBe(true);
    });

    it('still flags actual profanity — standalone "ass"', () => {
      expect(containsProfanity('get off your ass and do something', 'moderate')).toBe(true);
    });

    it('still flags basic profanity unchanged', () => {
      expect(containsProfanity('what the fuck is this', 'moderate')).toBe(true);
      expect(containsProfanity('this is absolute shit', 'moderate')).toBe(true);
    });
  });

  describe('isInSafeProfanityContext', () => {
    it('returns true for "damn" in "damn good" context', () => {
      expect(isInSafeProfanityContext('damn', 'a damn good idea')).toBe(true);
    });

    it('returns true for "dick" in "moby dick" context', () => {
      expect(isInSafeProfanityContext('dick', 'reading moby dick today')).toBe(true);
    });

    it('returns false for "damn" without safe context', () => {
      expect(isInSafeProfanityContext('damn', 'damn you for this')).toBe(false);
    });

    it('returns false for words not in context map', () => {
      expect(isInSafeProfanityContext('fuck', 'what the fuck')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isInSafeProfanityContext('Dick', 'Reading MOBY DICK in class')).toBe(true);
    });

    it('returns false for empty safe contexts (e.g., "whore")', () => {
      expect(isInSafeProfanityContext('whore', 'some whore context')).toBe(false);
    });
  });

  describe('sensitivity levels', () => {
    it('mild catches the worst words', () => {
      expect(containsProfanity('fuck this', 'mild')).toBe(true);
      expect(containsProfanity('shit happens', 'mild')).toBe(true);
    });

    it('moderate catches standard profanity', () => {
      expect(containsProfanity('what an asshole', 'moderate')).toBe(true);
      expect(containsProfanity('damn it', 'moderate')).toBe(true);
    });

    it('strict catches everything', () => {
      expect(containsProfanity('fuck', 'strict')).toBe(true);
      expect(containsProfanity('damn', 'strict')).toBe(true);
    });
  });

  describe('sexual/adult content words at moderate sensitivity', () => {
    it('detects "sex" at moderate sensitivity', () => {
      expect(containsProfanity('let\'s talk about sex', 'moderate')).toBe(true);
    });

    it('does NOT detect "sex" at mild sensitivity', () => {
      expect(containsProfanity('let\'s talk about sex', 'mild')).toBe(false);
    });

    it('detects "sexy" at moderate sensitivity', () => {
      expect(containsProfanity('that outfit is sexy', 'moderate')).toBe(true);
    });

    it('detects "porn" at moderate sensitivity', () => {
      expect(containsProfanity('watching porn online', 'moderate')).toBe(true);
    });

    it('detects "nude" at moderate sensitivity', () => {
      expect(containsProfanity('a nude photo was leaked', 'moderate')).toBe(true);
    });

    it('does NOT detect "sex" in "biological sex" safe context', () => {
      expect(containsProfanity('the biological sex of the organism', 'moderate')).toBe(false);
    });

    it('does NOT detect "sex" in "sex education" safe context', () => {
      expect(containsProfanity('the school offers sex education classes', 'moderate')).toBe(false);
    });

    it('does NOT detect "sex" in "opposite sex" safe context', () => {
      expect(containsProfanity('attracted to the opposite sex', 'moderate')).toBe(false);
    });

    it('does NOT detect "sex" in "sex chromosome" safe context', () => {
      expect(containsProfanity('the sex chromosome determines gender', 'moderate')).toBe(false);
    });

    it('still detects "sex" outside safe context at moderate', () => {
      expect(containsProfanity('they had sex last night', 'moderate')).toBe(true);
    });
  });

  describe('isInSafeProfanityContext for "sex"', () => {
    it('returns true for "sex" in "biological sex"', () => {
      expect(isInSafeProfanityContext('sex', 'the biological sex of the patient')).toBe(true);
    });

    it('returns true for "sex" in "sex education"', () => {
      expect(isInSafeProfanityContext('sex', 'comprehensive sex education program')).toBe(true);
    });

    it('returns true for "sex" in "same sex"', () => {
      expect(isInSafeProfanityContext('sex', 'same sex marriage is legal')).toBe(true);
    });

    it('returns false for "sex" without safe context', () => {
      expect(isInSafeProfanityContext('sex', 'they had sex last night')).toBe(false);
    });
  });
});
