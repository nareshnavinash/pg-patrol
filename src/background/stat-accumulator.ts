import { incrementStats } from '../shared/storage';

/**
 * Tracks per-tab replacement stats and persists deltas to chrome.storage.sync
 * on a debounced timer (5s) and immediately on tab close.
 */
export class StatAccumulator {
  private completedPages = new Map<number, { words: number; images: number }>();
  private currentPage = new Map<number, { words: number; images: number }>();
  private persisted = new Map<number, { words: number; images: number }>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  onStatsUpdate(
    tabId: number,
    prev: { wordsReplaced: number; imagesReplaced: number },
    curr: { wordsReplaced: number; imagesReplaced: number },
  ): void {
    // Navigation detected: counts went down → accumulate old page's final stats
    if (curr.wordsReplaced < prev.wordsReplaced || curr.imagesReplaced < prev.imagesReplaced) {
      const completed = this.completedPages.get(tabId) ?? { words: 0, images: 0 };
      this.completedPages.set(tabId, {
        words: completed.words + prev.wordsReplaced,
        images: completed.images + prev.imagesReplaced,
      });
    }
    this.currentPage.set(tabId, { words: curr.wordsReplaced, images: curr.imagesReplaced });
    this.scheduleFlush();
  }

  async onTabRemoved(
    tabId: number,
    currentStats: { wordsReplaced: number; imagesReplaced: number } | undefined,
  ): Promise<void> {
    const stats = currentStats ?? { wordsReplaced: 0, imagesReplaced: 0 };
    this.currentPage.set(tabId, { words: stats.wordsReplaced, images: stats.imagesReplaced });
    await this.flushTab(tabId);
    this.completedPages.delete(tabId);
    this.currentPage.delete(tabId);
    this.persisted.delete(tabId);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(() => {});
    }, 5000);
  }

  private async flushTab(tabId: number): Promise<void> {
    const completed = this.completedPages.get(tabId) ?? { words: 0, images: 0 };
    const current = this.currentPage.get(tabId) ?? { words: 0, images: 0 };
    const already = this.persisted.get(tabId) ?? { words: 0, images: 0 };

    const deltaWords = Math.max(0, completed.words + current.words - already.words);
    const deltaImages = Math.max(0, completed.images + current.images - already.images);

    if (deltaWords > 0 || deltaImages > 0) {
      await incrementStats(deltaWords, deltaImages);
      this.persisted.set(tabId, {
        words: already.words + deltaWords,
        images: already.images + deltaImages,
      });
    }
  }

  private async flush(): Promise<void> {
    let totalWords = 0;
    let totalImages = 0;

    for (const [tabId] of this.currentPage) {
      const completed = this.completedPages.get(tabId) ?? { words: 0, images: 0 };
      const current = this.currentPage.get(tabId)!;
      const already = this.persisted.get(tabId) ?? { words: 0, images: 0 };

      const dw = Math.max(0, completed.words + current.words - already.words);
      const di = Math.max(0, completed.images + current.images - already.images);

      if (dw > 0 || di > 0) {
        totalWords += dw;
        totalImages += di;
        this.persisted.set(tabId, {
          words: already.words + dw,
          images: already.images + di,
        });
      }
    }

    if (totalWords > 0 || totalImages > 0) {
      await incrementStats(totalWords, totalImages);
    }
  }
}
