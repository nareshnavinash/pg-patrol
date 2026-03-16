import {
  scoreText,
  isNegativeContent,
  isInSafeNgram,
  isPrecededByNegation,
} from '../../src/shared/negative-news-engine';

describe('negative-news-engine', () => {
  describe('scoreText', () => {
    it('scores war/violence text as negative', () => {
      const result = scoreText(
        'The bombing campaign has killed dozens. Victims were taken to local hospitals.',
      );
      expect(result.isNegative).toBe(true);
      expect(result.score).toBeGreaterThan(0.03);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('scores clean text as not negative', () => {
      const result = scoreText(
        'The weather is beautiful today with clear skies and mild temperatures across the region.',
      );
      expect(result.isNegative).toBe(false);
      expect(result.score).toBeLessThanOrEqual(0.03);
    });

    it('scores sports news as not negative', () => {
      const result = scoreText(
        'The Golden State Warriors dominated with a record-breaking performance in the championship game.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('dampens score with safe-context words', () => {
      // "shooting" is a trigger, but "basketball" + "game" + "score" dampen it
      const result = scoreText(
        'Curry shooting 60% from three in Warriors victory. The basketball game score was incredible.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('amplifiers increase the score', () => {
      const withAmplifiers = scoreText(
        'The bombing killed dozens of victims in a devastating attack.',
      );
      const withoutAmplifiers = scoreText(
        'A bombing was reported in the area near the city center.',
      );
      expect(withAmplifiers.score).toBeGreaterThan(withoutAmplifiers.score);
    });

    it('matches multi-word phrases like "death toll"', () => {
      const result = scoreText('The death toll from the earthquake has risen to over one hundred.');
      expect(result.isNegative).toBe(true);
      const phraseMatch = result.matches.find((m) => m.phrase === 'death toll');
      expect(phraseMatch).toBeDefined();
      expect(phraseMatch!.category).toBe('death');
    });

    it('matches "civil war" as a phrase', () => {
      const result = scoreText('The civil war has displaced millions of people from their homes.');
      expect(result.isNegative).toBe(true);
      const phraseMatch = result.matches.find((m) => m.phrase === 'civil war');
      expect(phraseMatch).toBeDefined();
    });

    it('returns correct categories for matches', () => {
      const result = scoreText(
        'The earthquake destroyed buildings and the tsunami caused flooding across the coast.',
      );
      expect(result.isNegative).toBe(true);
      const categories = result.matches.map((m) => m.category);
      expect(categories).toContain('disaster');
    });

    it('returns not negative for empty text', () => {
      expect(scoreText('').isNegative).toBe(false);
      expect(scoreText('   ').isNegative).toBe(false);
    });

    it('handles text with only URLs', () => {
      const result = scoreText('https://example.com/war-bombing-killing');
      expect(result.isNegative).toBe(false);
    });

    it('scores terrorism-related text as negative', () => {
      const result = scoreText('The terrorist attack killed several hostages in a horrific siege.');
      expect(result.isNegative).toBe(true);
    });

    it('scores crime text as negative', () => {
      const result = scoreText(
        'A shooting leaves three injured downtown. Police respond to a deadly attack near the city center.',
      );
      expect(result.isNegative).toBe(true);
    });

    it('does not flag movie/entertainment context', () => {
      const result = scoreText(
        'The new action movie features an incredible battle scene. The film review gave it five stars.',
      );
      expect(result.isNegative).toBe(false);
    });
  });

  describe('n-gram context analysis', () => {
    it('does not flag "killed it" as negative', () => {
      const result = scoreText('I killed it at the game last night.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "killed the game" as negative', () => {
      const result = scoreText('That performance killed the game. Everyone loved it.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "shooting star" as negative', () => {
      const result = scoreText('We saw a beautiful shooting star last night over the mountains.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "shooting hoops" as negative', () => {
      const result = scoreText('We spent the afternoon shooting hoops at the park.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "star wars" context for "war"', () => {
      const result = scoreText(
        'The new Star Wars movie has amazing special effects and great acting.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "tug of war" as negative', () => {
      const result = scoreText('The children played tug of war at the school picnic.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "dead end" or "deadline" as negative', () => {
      const result = scoreText('We reached a dead end on the road, but the deadline is tomorrow.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "crash course" as negative', () => {
      const result = scoreText('I took a crash course in Python programming last weekend.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "flawless execution" as negative', () => {
      const result = scoreText('The team delivered flawless execution on the project.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "shelling peas" as negative', () => {
      const result = scoreText('Grandma was shelling peas on the porch this morning.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "spreading like wildfire" as negative', () => {
      const result = scoreText('The new trend is spreading like wildfire on social media.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "battle royale" (gaming) as negative', () => {
      const result = scoreText('The new battle royale game has incredible graphics.');
      expect(result.isNegative).toBe(false);
    });

    it('does not flag "price war" as negative', () => {
      const result = scoreText('The price war between retailers is saving consumers money.');
      expect(result.isNegative).toBe(false);
    });

    it('still flags actual violence with trigger words', () => {
      const result = scoreText('The bombing killed dozens of people in the city center.');
      expect(result.isNegative).toBe(true);
    });

    it('still flags actual war news', () => {
      const result = scoreText('The war has displaced millions. Troops advanced into the region.');
      expect(result.isNegative).toBe(true);
    });

    it('still flags actual shooting news', () => {
      const result = scoreText(
        'A shooting at the mall left three people injured. Police responded.',
      );
      expect(result.isNegative).toBe(true);
    });
  });

  describe('negation detection', () => {
    it('skips negated trigger — "not" before "bombing"', () => {
      const negated = scoreText('This is not a bombing. It was just a fireworks show in the park.');
      const affirmed = scoreText('A bombing was reported near the downtown area today.');
      expect(negated.score).toBeLessThan(affirmed.score);
    });

    it('skips "no war" — negation before trigger', () => {
      const result = scoreText(
        'There is no war happening in this beautiful region. Peace and joy prevail here every day.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('skips "never killed" — negation before trigger', () => {
      const result = scoreText(
        'He never killed anyone in his life. He is a very peaceful person who loves and cares deeply.',
      );
      expect(result.isNegative).toBe(false);
    });

    it("skips contraction negation: isn't, don't, etc.", () => {
      const result = scoreText(
        "This isn't terrorism and you should know that. Don't worry about the current situation at all.",
      );
      expect(result.isNegative).toBe(false);
    });

    it('skips "without" as negation before trigger', () => {
      const result = scoreText(
        'The peaceful protest was conducted without assault or any violent incidents at all.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('skips "hardly any casualties" — negation before trigger', () => {
      const result = scoreText(
        'The minor weather event resulted in hardly any casualties in the region. Most people are safe and well.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('skips "zero fatalities" — negation before trigger', () => {
      const result = scoreText(
        'The minor traffic accident resulted in zero fatalities and everyone is safe and doing well today.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('does not dampen when negation is too far away', () => {
      // "not" is more than 3 tokens before "killed"
      const result = scoreText('It is not clear what happened but many were killed in the end.');
      expect(result.matches.some((m) => m.phrase === 'killed')).toBe(true);
    });

    it('negated triggers produce near-zero score while affirmed produce positive score', () => {
      const negated = scoreText('This is not a bombing. This is not terrorism. This is not war.');
      const affirmed = scoreText('There was a bombing. There was terrorism. There was a war.');
      expect(negated.score).toBeLessThan(0.001);
      expect(negated.isNegative).toBe(false);
      expect(affirmed.score).toBeGreaterThan(0);
      expect(affirmed.isNegative).toBe(true);
    });
  });

  describe('isInSafeNgram', () => {
    it('returns true when trigger is in a safe n-gram', () => {
      expect(isInSafeNgram('killed', 'she really killed it at the concert')).toBe(true);
    });

    it('returns false when trigger is not in a safe n-gram', () => {
      expect(isInSafeNgram('killed', 'the suspect killed several victims')).toBe(false);
    });

    it('returns false for words not in the safe n-gram map', () => {
      expect(isInSafeNgram('genocide', 'the genocide was terrible')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isInSafeNgram('shooting', 'Beautiful SHOOTING STAR in the sky')).toBe(true);
    });
  });

  describe('isPrecededByNegation', () => {
    it('detects "not" before position', () => {
      const text = 'this is not violent at all';
      const idx = text.indexOf('violent');
      expect(isPrecededByNegation(text, idx)).toBe(true);
    });

    it('detects "never" before position', () => {
      const text = 'he never killed anyone';
      const idx = text.indexOf('killed');
      expect(isPrecededByNegation(text, idx)).toBe(true);
    });

    it('detects contraction negation', () => {
      const text = "it wasn't a shooting";
      const idx = text.indexOf('shooting');
      expect(isPrecededByNegation(text, idx)).toBe(true);
    });

    it('returns false when no negation nearby', () => {
      const text = 'the terrible bombing was devastating';
      const idx = text.indexOf('bombing');
      expect(isPrecededByNegation(text, idx)).toBe(false);
    });

    it('returns false when negation is too far', () => {
      const text = 'not something that we think is a bombing really';
      const idx = text.indexOf('bombing');
      expect(isPrecededByNegation(text, idx)).toBe(false);
    });
  });

  describe('Bayesian ensemble scoring', () => {
    it('catches implicit toxicity without trigger words ("you are worthless")', () => {
      const result = scoreText('You are worthless and nobody cares about you.');
      expect(result.isNegative).toBe(true);
    });

    it('catches insults without trigger words ("stupid and pathetic")', () => {
      const result = scoreText('You are stupid and pathetic. Nobody likes you at all.');
      expect(result.isNegative).toBe(true);
    });

    it('does not flag clean positive text', () => {
      const result = scoreText(
        'What a wonderful day! The team had a great time learning together and sharing knowledge.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('does not flag neutral everyday text', () => {
      const result = scoreText(
        'The new technology project is going well. The team is working on a creative design.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('keyword engine still handles trigger words without Bayes interference', () => {
      const result = scoreText(
        'The bombing killed dozens. Victims were devastated. The massacre was horrific.',
      );
      expect(result.isNegative).toBe(true);
      expect(result.score).toBeGreaterThan(0.05);
    });

    it('Bayes does not interfere when keywords are suppressed by n-grams', () => {
      const result = scoreText('I killed it at the game last night. It was amazing.');
      expect(result.isNegative).toBe(false);
    });

    it('Bayes does not interfere when keywords are suppressed by negation', () => {
      const result = scoreText(
        'There is no war happening in this beautiful region. Peace and joy prevail here every day.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('Bayes contribution is small enough to not cause false positives on neutral text', () => {
      const result = scoreText(
        'People work at their jobs every day. Time goes by and things are good.',
      );
      expect(result.isNegative).toBe(false);
    });

    it('does not flag text with only safe-vocabulary words', () => {
      const result = scoreText(
        'Thank you for the wonderful help. The family enjoyed a delicious meal together.',
      );
      expect(result.isNegative).toBe(false);
      expect(result.score).toBeLessThan(0.01);
    });
  });

  describe('isNegativeContent', () => {
    it('returns true for negative content', () => {
      expect(isNegativeContent('War continues as casualties mount and bombing intensifies.')).toBe(
        true,
      );
    });

    it('returns false for clean content', () => {
      expect(
        isNegativeContent('Local bakery wins best croissant award at the food festival.'),
      ).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isNegativeContent('')).toBe(false);
    });
  });
});
