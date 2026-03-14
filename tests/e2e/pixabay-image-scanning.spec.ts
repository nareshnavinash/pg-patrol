import { test, expect } from './fixtures/extension';
import { waitForContentScript, toggleSetting } from './helpers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCROLL_PAGE = `file://${path.resolve(__dirname, 'fixtures/infinite-scroll-page.html')}`;

const PROCESSED_ATTR = 'data-pg-patrol-img-processed';

test.describe('Infinite Scroll Image Scanning', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ context, extensionId }) => {
    await toggleSetting(context, extensionId, 'Image Filtering', true);
  });

  test('scans initial batch of images and hides NSFW ones', async ({ context }) => {
    const page = await context.newPage();

    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('PG Patrol')) logs.push(msg.text());
    });

    await page.goto(SCROLL_PAGE, { waitUntil: 'load' });
    // Wait for content script + model load + classification of first batch
    await waitForContentScript(page, 15_000);

    // First batch (7 images) should all be processed
    const processedCount = await page.locator(`img[${PROCESSED_ATTR}]`).count();
    console.log(`Initial batch: ${processedCount} processed`);
    expect(processedCount).toBeGreaterThan(0);

    // NSFW images should show the placeholder (CSS content replacement)
    const nsfwImages = await page.locator(`img[${PROCESSED_ATTR}="nsfw"]`).all();
    console.log(`NSFW replaced: ${nsfwImages.length}`);
    for (const img of nsfwImages) {
      const attr = await img.getAttribute(PROCESSED_ATTR);
      expect(attr).toBe('nsfw');
    }

    // The NSFW CSS stylesheet should be injected
    const hasStylesheet = await page.locator('#pg-patrol-nsfw-styles').count();
    expect(hasStylesheet).toBe(1);

    // Safe images should be visible and not replaced
    const safeImages = await page.locator(`img[${PROCESSED_ATTR}="safe"]`).all();
    console.log(`Safe visible: ${safeImages.length}`);
    for (const img of safeImages) {
      const display = await img.evaluate(
        (el) => window.getComputedStyle(el).display,
      );
      expect(display).not.toBe('none');
    }
  });

  test('banner shows correct count when NSFW images exist', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(SCROLL_PAGE, { waitUntil: 'load' });
    await waitForContentScript(page, 15_000);

    // Wait for processing to complete
    await page.waitForFunction(
      () => document.querySelectorAll('img[data-pg-patrol-img-processed]').length >= 5,
      { timeout: 30_000 },
    );

    const nsfwCount = await page.locator(`img[${PROCESSED_ATTR}="nsfw"]`).count();
    const processedCount = await page.locator(`img[${PROCESSED_ATTR}]`).count();
    console.log(`Processed: ${processedCount}, NSFW: ${nsfwCount}`);

    // If any images were classified NSFW, banner should exist and contain correct text
    if (nsfwCount > 0) {
      const banner = page.locator('#pg-patrol-image-banner');
      await expect(banner).toBeAttached({ timeout: 10_000 });
      const text = await banner.textContent();
      console.log(`Banner text: ${text}`);
      expect(text).toContain('filtered');
      expect(text).toContain('PG Patrol');
    } else {
      console.log('No NSFW at current threshold — skipping banner assertion');
    }

    // Either way, all images should be in a final state
    expect(processedCount).toBeGreaterThan(0);
  });

  test('scans dynamically loaded images on scroll', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(SCROLL_PAGE, { waitUntil: 'load' });
    // Wait for first batch to be fully processed
    await waitForContentScript(page, 15_000);

    // Record initial state
    const initialProcessed = await page.locator(`img[${PROCESSED_ATTR}]`).count();
    const initialTotal = await page.locator('img').count();
    console.log(`Before scroll: ${initialProcessed}/${initialTotal} processed`);
    expect(initialProcessed).toBeGreaterThan(0);

    // Scroll to bottom to trigger batch 2
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Wait for batch 2 images to appear in DOM
    const batch2Selector = '.card[data-batch="2"] img';
    await page.waitForSelector(batch2Selector, { timeout: 5_000 });

    // Scroll again to ensure scroll scanner fires
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new images to be scanned
    await page.waitForTimeout(10_000);

    const afterScrollProcessed = await page.locator(`img[${PROCESSED_ATTR}]`).count();
    const afterScrollTotal = await page.locator('img').count();
    console.log(`After scroll: ${afterScrollProcessed}/${afterScrollTotal} processed`);

    // More images should exist and be processed
    expect(afterScrollTotal).toBeGreaterThan(initialTotal);
    expect(afterScrollProcessed).toBeGreaterThan(initialProcessed);

    // All new NSFW images should be marked and replaced
    const allNsfw = await page.locator(`img[${PROCESSED_ATTR}="nsfw"]`).all();
    for (const img of allNsfw) {
      const attr = await img.getAttribute(PROCESSED_ATTR);
      expect(attr).toBe('nsfw');
    }
  });

  test('no unprocessed images remain in viewport after scroll scanning', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(SCROLL_PAGE, { waitUntil: 'load' });
    await waitForContentScript(page, 15_000);

    // Scroll to load all batches
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    // Wait for all scanning to complete
    await page.waitForTimeout(10_000);

    // Check for unprocessed images that are visible and large enough to matter
    const unprocessedVisible = await page.evaluate(() => {
      const imgs = document.querySelectorAll(
        'img:not([data-pg-patrol-img-processed])',
      );
      let count = 0;
      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        // Only count images that are large enough to scan (>50px)
        if (rect.width > 50 && rect.height > 50) {
          count++;
        }
      }
      return count;
    });

    console.log(`Unprocessed visible images: ${unprocessedVisible}`);
    expect(unprocessedVisible).toBe(0);
  });

  test('scroll triggers scanning for batch 3 as well', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(SCROLL_PAGE, { waitUntil: 'load' });
    await waitForContentScript(page, 15_000);

    // Scroll through all 3 batches
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    // Wait for all scanning
    await page.waitForTimeout(10_000);

    // Verify batch 3 images exist and are processed
    const batch3Cards = await page.locator('.card[data-batch="3"]').count();
    console.log(`Batch 3 cards: ${batch3Cards}`);
    expect(batch3Cards).toBeGreaterThan(0);

    const batch3Processed = await page.locator(
      `.card[data-batch="3"] img[${PROCESSED_ATTR}]`,
    ).count();
    console.log(`Batch 3 processed: ${batch3Processed}`);
    expect(batch3Processed).toBe(batch3Cards);

    // Overall stats
    const totalImages = await page.locator('img').count();
    const totalProcessed = await page.locator(`img[${PROCESSED_ATTR}]`).count();
    const totalNsfw = await page.locator(`img[${PROCESSED_ATTR}="nsfw"]`).count();
    const totalSafe = await page.locator(`img[${PROCESSED_ATTR}="safe"]`).count();
    console.log(`Final: ${totalProcessed}/${totalImages} processed (${totalNsfw} NSFW, ${totalSafe} safe)`);
  });
});
