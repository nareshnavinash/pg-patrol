import { StatAccumulator } from '../../src/background/stat-accumulator';
import { incrementStats } from '../../src/shared/storage';

jest.mock('../../src/shared/storage', () => ({
  incrementStats: jest.fn(() => Promise.resolve()),
}));

const mockIncrementStats = incrementStats as jest.MockedFunction<typeof incrementStats>;

describe('StatAccumulator', () => {
  let acc: StatAccumulator;

  beforeEach(() => {
    jest.useFakeTimers();
    acc = new StatAccumulator();
    mockIncrementStats.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounced flush', () => {
    it('persists stats after 5s debounce', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );
      expect(mockIncrementStats).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      // Flush is async — let microtasks settle
      await Promise.resolve();

      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);
    });

    it('batches multiple updates within the debounce window into one flush', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 3, imagesReplaced: 1 },
      );
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 3, imagesReplaced: 1 },
        { wordsReplaced: 8, imagesReplaced: 4 },
      );
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 8, imagesReplaced: 4 },
        { wordsReplaced: 10, imagesReplaced: 5 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockIncrementStats).toHaveBeenCalledTimes(1);
      expect(mockIncrementStats).toHaveBeenCalledWith(10, 5);
    });

    it('does not persist when stats are zero', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 0, imagesReplaced: 0 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockIncrementStats).not.toHaveBeenCalled();
    });

    it('only persists the delta on subsequent flushes', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);

      mockIncrementStats.mockClear();

      // More updates on the same page
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 5, imagesReplaced: 2 },
        { wordsReplaced: 12, imagesReplaced: 3 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(mockIncrementStats).toHaveBeenCalledWith(7, 1); // delta only
    });
  });

  describe('navigation detection', () => {
    it('accumulates previous page stats when word count drops', async () => {
      // Page 1: 10 words, 3 images
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 10, imagesReplaced: 3 },
      );
      // Navigate to page 2 (counts drop)
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 10, imagesReplaced: 3 },
        { wordsReplaced: 2, imagesReplaced: 0 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Grand total: completed(10+3) + current(2+0) = 12 words, 3 images
      expect(mockIncrementStats).toHaveBeenCalledWith(12, 3);
    });

    it('accumulates across multiple navigations in the same tab', async () => {
      // Page 1
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );
      // Page 1 → Page 2
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 5, imagesReplaced: 2 },
        { wordsReplaced: 0, imagesReplaced: 0 },
      );
      // Page 2 grows
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 3, imagesReplaced: 1 },
      );
      // Page 2 → Page 3
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 3, imagesReplaced: 1 },
        { wordsReplaced: 0, imagesReplaced: 0 },
      );
      // Page 3 grows
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 7, imagesReplaced: 0 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // completed: (5+2) + (3+1) = 8 words, 3 images; current: 7+0
      expect(mockIncrementStats).toHaveBeenCalledWith(15, 3);
    });
  });

  describe('onTabRemoved', () => {
    it('immediately flushes remaining delta on tab close', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );
      // Don't advance timers — close tab immediately
      await acc.onTabRemoved(1, { wordsReplaced: 5, imagesReplaced: 2 });

      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);
    });

    it('does not double-count after a debounced flush already persisted', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);

      mockIncrementStats.mockClear();

      // Tab closes with same stats — delta should be 0
      await acc.onTabRemoved(1, { wordsReplaced: 5, imagesReplaced: 2 });
      expect(mockIncrementStats).not.toHaveBeenCalled();
    });

    it('persists only the remaining delta after partial flush', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 2 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);

      mockIncrementStats.mockClear();

      // More updates, then tab close
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 5, imagesReplaced: 2 },
        { wordsReplaced: 12, imagesReplaced: 3 },
      );
      await acc.onTabRemoved(1, { wordsReplaced: 12, imagesReplaced: 3 });

      expect(mockIncrementStats).toHaveBeenCalledWith(7, 1);
    });

    it('persists current stats even without prior onStatsUpdate', async () => {
      await acc.onTabRemoved(1, { wordsReplaced: 5, imagesReplaced: 2 });
      expect(mockIncrementStats).toHaveBeenCalledWith(5, 2);
    });

    it('skips incrementStats when totals are zero', async () => {
      await acc.onTabRemoved(1, { wordsReplaced: 0, imagesReplaced: 0 });
      expect(mockIncrementStats).not.toHaveBeenCalled();
    });

    it('skips incrementStats when currentStats is undefined', async () => {
      await acc.onTabRemoved(1, undefined);
      expect(mockIncrementStats).not.toHaveBeenCalled();
    });

    it('cleans up all state after tab removal', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 10, imagesReplaced: 5 },
      );
      // Navigate
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 10, imagesReplaced: 5 },
        { wordsReplaced: 0, imagesReplaced: 0 },
      );
      await acc.onTabRemoved(1, { wordsReplaced: 3, imagesReplaced: 0 });
      expect(mockIncrementStats).toHaveBeenCalledWith(13, 5);

      mockIncrementStats.mockClear();

      // Reuse same tabId — should have no stale state
      await acc.onTabRemoved(1, { wordsReplaced: 0, imagesReplaced: 0 });
      expect(mockIncrementStats).not.toHaveBeenCalled();
    });
  });

  describe('multiple tabs', () => {
    it('tracks tabs independently and batches into one flush', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 1 },
      );
      acc.onStatsUpdate(
        2,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 10, imagesReplaced: 3 },
      );

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockIncrementStats).toHaveBeenCalledTimes(1);
      expect(mockIncrementStats).toHaveBeenCalledWith(15, 4); // batched
    });

    it('closing one tab does not affect another', async () => {
      acc.onStatsUpdate(
        1,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 5, imagesReplaced: 1 },
      );
      acc.onStatsUpdate(
        2,
        { wordsReplaced: 0, imagesReplaced: 0 },
        { wordsReplaced: 10, imagesReplaced: 3 },
      );

      await acc.onTabRemoved(1, { wordsReplaced: 5, imagesReplaced: 1 });
      expect(mockIncrementStats).toHaveBeenCalledWith(5, 1);

      mockIncrementStats.mockClear();

      // Tab 2 flushes on timer — should still have its full delta
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockIncrementStats).toHaveBeenCalledWith(10, 3);
    });
  });
});
