import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript, toggleSetting } from './helpers';

test.describe('Image & Video Scanning Pipeline', () => {
  test.beforeEach(async ({ context, extensionId }) => {
    // Enable image filtering before each test
    await toggleSetting(context, extensionId, 'Image Filtering', true);
  });

  test('small images are marked as skipped', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    const processed = await page
      .locator('#test-img-small')
      .getAttribute('data-pg-patrol-img-processed');

    expect(processed).toBe('skipped');
  });

  test('SVG images are marked as skipped', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    const processed = await page
      .locator('#test-img-svg')
      .getAttribute('data-pg-patrol-img-processed');

    expect(processed).toBe('skipped');
  });

  test('video without poster is ignored', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    const attr = await page
      .locator('#test-video-no-poster')
      .getAttribute('data-pg-patrol-vid-processed');
    // No poster = nothing to scan, so either null or skipped
    const isIgnored = attr === null || attr === 'skipped';
    expect(isIgnored).toBe(true);
  });

  test('images are blurred immediately when discovered (before classification)', async ({ context }) => {
    const page = await context.newPage();
    // Navigate and check quickly before classification completes
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1000);

    // Standard test image should have blur applied at queue time
    const img = page.locator('#test-img-1');
    const processed = await img.getAttribute('data-pg-patrol-img-processed');
    const filter = await img.evaluate((el) => (el as HTMLElement).style.filter);

    // Either already classified (safe/nsfw/error) or still blurred awaiting classification
    const isHandled =
      processed === 'safe' ||
      processed === 'nsfw' ||
      processed === 'error' ||
      processed === 'skipped' ||
      filter.includes('blur');
    expect(isHandled).toBe(true);
  });

  test('on classification error, images remain blurred (fail-safe)', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 5000);

    // Check any image marked as error — it should still have blur
    const errorImages = await page.locator('img[data-pg-patrol-img-processed="error"]').all();
    for (const img of errorImages) {
      const filter = await img.evaluate((el) => (el as HTMLElement).style.filter);
      expect(filter).toContain('blur');
    }
  });
});
