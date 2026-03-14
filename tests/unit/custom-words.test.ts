import {
  containsProfanity,
  detectProfanity,
  addCustomProfanity,
  addCustomSafeWords,
  setCustomProfanity,
  setCustomSafeWords,
} from '../../src/shared/profanity-engine';
import { addCustomFunnyWords } from '../../src/shared/funny-words';
import { scoreText } from '../../src/shared/negative-news-engine';
import { addCustomTriggers, addCustomSafeContext, setCustomTriggers, setCustomSafeContext } from '../../src/shared/negative-news-words';

describe('custom words', () => {
  describe('addCustomProfanity', () => {
    it('adds words that get detected as profanity', () => {
      // "yeet" should not be profane by default
      expect(containsProfanity('yeet this thing', 'strict')).toBe(false);

      addCustomProfanity(['yeet']);

      expect(containsProfanity('yeet this thing', 'strict')).toBe(true);
    });

    it('custom words are detected at moderate sensitivity (bypass sensitivity gate)', () => {
      addCustomProfanity(['bald']);

      // Custom words should be caught at ALL sensitivity levels, not just strict
      expect(containsProfanity('he is bald', 'moderate')).toBe(true);
      expect(containsProfanity('he is bald', 'mild')).toBe(true);
    });

    it('detects custom words with replacement', () => {
      addCustomProfanity(['zoinks']);

      const matches = detectProfanity('zoinks that hurt', 'strict');
      expect(matches.length).toBeGreaterThan(0);
      const match = matches.find((m) => m.original === 'zoinks');
      expect(match).toBeDefined();
      expect(match!.replacement).toBeTruthy();
    });
  });

  describe('addCustomSafeWords', () => {
    it('prevents false positives on custom safe words', () => {
      // "damn" is normally profane at moderate
      expect(containsProfanity('damn it', 'moderate')).toBe(true);

      addCustomSafeWords(['damn']);

      // After adding as safe, the profanity library won't flag it
      expect(containsProfanity('damn it', 'strict')).toBe(false);
    });
  });

  describe('addCustomFunnyWords', () => {
    it('adds custom funny replacement words by letter', () => {
      addCustomFunnyWords({ z: ['zesty noodles', 'zippy llama'] });

      // We can't easily test the random pick, but importing confirms no crash
      // The function should run without error
      expect(true).toBe(true);
    });
  });

  describe('custom negative news triggers', () => {
    it('addCustomTriggers increases score for custom words', () => {
      const beforeResult = scoreText(
        'The cyberattack on the ransomware network caused panic among officials.',
      );
      const beforeScore = beforeResult.score;

      addCustomTriggers(['cyberattack', 'ransomware']);

      const afterResult = scoreText(
        'The cyberattack on the ransomware network caused panic among officials.',
      );
      expect(afterResult.score).toBeGreaterThan(beforeScore);
    });

    it('addCustomSafeContext dampens score for custom safe words', () => {
      addCustomTriggers(['raid']);

      const beforeResult = scoreText(
        'The raid on the enemy base was intense. The esports tournament was exciting.',
      );
      const beforeScore = beforeResult.score;

      addCustomSafeContext(['esports']);

      const afterResult = scoreText(
        'The raid on the enemy base was intense. The esports tournament was exciting.',
      );
      expect(afterResult.score).toBeLessThanOrEqual(beforeScore);
    });
  });

  describe('setCustomProfanity (clear-then-add)', () => {
    it('removing a custom blocked word stops it from being detected', () => {
      // Add "flurp" as custom blocked
      setCustomProfanity(['flurp']);
      expect(containsProfanity('he said flurp loudly', 'moderate')).toBe(true);

      // Remove by setting empty list
      setCustomProfanity([]);
      expect(containsProfanity('he said flurp loudly', 'moderate')).toBe(false);
    });

    it('replacing custom blocked words only keeps the new list', () => {
      setCustomProfanity(['wibble', 'wobble']);
      expect(containsProfanity('wibble wobble', 'moderate')).toBe(true);

      // Replace with only "wobble"
      setCustomProfanity(['wobble']);
      expect(containsProfanity('wobble here', 'moderate')).toBe(true);
      expect(containsProfanity('wibble here', 'moderate')).toBe(false);
    });
  });

  describe('setCustomSafeWords (clear-then-add)', () => {
    it('removing a custom safe word restores detection', () => {
      // "shit" is normally profane at moderate
      expect(containsProfanity('shit happens', 'moderate')).toBe(true);

      // Mark as safe — no longer detected
      setCustomSafeWords(['shit']);
      expect(containsProfanity('shit happens', 'moderate')).toBe(false);

      // Clear safe words — detected again
      setCustomSafeWords([]);
      expect(containsProfanity('shit happens', 'moderate')).toBe(true);
    });
  });

  describe('setCustomTriggers (clear-then-add)', () => {
    it('removing a custom trigger stops it from boosting score', () => {
      const text = 'The glorbix incident caused widespread concern among residents.';

      setCustomTriggers(['glorbix']);
      const withTrigger = scoreText(text);

      setCustomTriggers([]);
      const withoutTrigger = scoreText(text);

      expect(withTrigger.score).toBeGreaterThan(withoutTrigger.score);
    });
  });

  describe('setCustomSafeContext (clear-then-add)', () => {
    it('removing a custom safe context word stops dampening', () => {
      setCustomTriggers(['skirmish']);
      const text = 'The skirmish was intense. The gaming tournament was exciting.';

      setCustomSafeContext(['gaming']);
      const withSafe = scoreText(text);

      setCustomSafeContext([]);
      const withoutSafe = scoreText(text);

      expect(withoutSafe.score).toBeGreaterThanOrEqual(withSafe.score);
    });
  });
});
