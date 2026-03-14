/**
 * @jest-environment jsdom
 */

import { replaceProfanity, addCustomProfanity, addCustomSafeWords } from '../../src/shared/profanity-engine';
import { scoreText } from '../../src/shared/negative-news-engine';
import { addCustomTriggers, addCustomSafeContext } from '../../src/shared/negative-news-words';

describe('custom words filtering integration', () => {
  describe('profanity pipeline with custom blocked words', () => {
    it('custom blocked word gets replaced with funny word in DOM', () => {
      addCustomProfanity(['flimflam']);

      document.body.innerHTML = '<p id="test">This is total flimflam right here</p>';
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;

      const result = replaceProfanity(textNode.textContent!, 'strict');
      expect(result.hasProfanity).toBe(true);
      expect(result.filtered).not.toContain('flimflam');
      expect(result.replacements.length).toBeGreaterThan(0);

      // Apply to DOM like content script would
      textNode.textContent = result.filtered;
      expect(p.textContent).not.toContain('flimflam');
    });
  });

  describe('profanity pipeline with custom safe words', () => {
    it('custom safe word is not filtered', () => {
      // Add a custom word then immediately mark it safe
      addCustomProfanity(['blarfoo']);
      // Verify it's detected first
      const beforeResult = replaceProfanity('This is total blarfoo right here', 'strict');
      expect(beforeResult.hasProfanity).toBe(true);

      addCustomSafeWords(['blarfoo']);

      document.body.innerHTML = '<p id="test">This is total blarfoo right here</p>';
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;

      const result = replaceProfanity(textNode.textContent!, 'strict');
      // "blarfoo" has been marked safe, so it should not be profane
      const match = result.replacements.find(
        (m) => m.original.toLowerCase() === 'blarfoo',
      );
      expect(match).toBeUndefined();
    });
  });

  describe('negative news pipeline with custom triggers', () => {
    it('custom trigger word flags content as negative', () => {
      addCustomTriggers(['meltdown']);

      const result = scoreText(
        'The nuclear meltdown caused widespread devastated communities and destroyed infrastructure.',
      );
      expect(result.score).toBeGreaterThan(0);
      // "meltdown" should appear in matches
      const meltdownMatch = result.matches.find((m) => m.phrase === 'meltdown');
      expect(meltdownMatch).toBeDefined();
      expect(meltdownMatch!.category).toBe('custom');
    });
  });

  describe('negative news pipeline with custom safe context', () => {
    it('custom safe context dampens negative score', () => {
      addCustomTriggers(['ambush']);

      const textWithoutSafe = 'The ambush killed several troops in the conflict zone.';
      const resultWithout = scoreText(textWithoutSafe);

      addCustomSafeContext(['paintball']);

      const textWithSafe = 'The ambush killed several troops in the paintball conflict zone.';
      const resultWith = scoreText(textWithSafe);

      // Safe context should dampen the score
      expect(resultWith.score).toBeLessThan(resultWithout.score);
    });
  });
});
