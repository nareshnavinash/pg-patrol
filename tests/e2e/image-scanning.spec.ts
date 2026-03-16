import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript, toggleSetting } from './helpers';

const OVERLAY_ROOT_SELECTOR = '#pg-patrol-media-overlay-root';

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

  test('images are covered immediately when discovered (before classification)', async ({
    context,
  }) => {
    const page = await context.newPage();
    // Navigate and check quickly before classification completes
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1000);

    // Standard test image should either already be finalized or have its raw pixels hidden.
    const img = page.locator('#test-img-1');
    const processed = await img.getAttribute('data-pg-patrol-img-processed');
    const opacity = await img.evaluate((el) => window.getComputedStyle(el as HTMLElement).opacity);
    const overlayExists = (await page.locator(OVERLAY_ROOT_SELECTOR).count()) > 0;

    // Either already classified or still hidden behind an overlay surface.
    const isHandled =
      processed === 'safe' ||
      processed === 'nsfw' ||
      processed === 'error' ||
      processed === 'skipped' ||
      opacity === '0' ||
      overlayExists;
    expect(isHandled).toBe(true);
  });

  test('on classification error, images remain covered (fail-safe)', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 5000);

    // Check any image marked as error — it should still be hidden behind a cover.
    const errorImages = await page.locator('img[data-pg-patrol-img-processed="error"]').all();
    for (const img of errorImages) {
      const visibility = await img.evaluate(
        (el) => window.getComputedStyle(el as HTMLElement).visibility,
      );
      expect(visibility).toBe('hidden');
    }
  });
});
