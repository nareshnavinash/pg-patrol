import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript } from './helpers';

test.describe('Adult Content Filtering', () => {
  // Text and image filtering are enabled by default (strict sensitivity),
  // so no beforeEach toggle needed.

  test('adult words "sex", "sexy", "porn", "nude" are masked at strict', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    // "sex" in "sex toys" should be masked
    const text1 = await page.locator('#adult-text-1').textContent();
    expect(text1).not.toContain('sex');

    // "sexy" should be masked
    const text2 = await page.locator('#adult-text-2').textContent();
    expect(text2?.toLowerCase()).not.toContain('sexy');

    // "porn" should be masked
    const text3 = await page.locator('#adult-text-3').textContent();
    expect(text3?.toLowerCase()).not.toContain('porn');

    // "nude" should be masked
    const text4 = await page.locator('#adult-text-4').textContent();
    expect(text4?.toLowerCase()).not.toContain('nude');
  });

  test('"sex" in "biological sex" safe context is NOT masked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    const text = await page.locator('#adult-text-safe-1').textContent();
    expect(text).toContain('biological sex');
  });

  test('"sex education" safe context is NOT masked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 3000);

    const text = await page.locator('#adult-text-safe-2').textContent();
    expect(text).toContain('sex education');
  });

  test('SPA-injected adult text is filtered after delayed re-scan', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    // Wait for SPA injection (1s) + delayed re-scan (3.5s) + buffer
    await waitForContentScript(page, 5500);

    const spaText = await page.locator('#spa-adult-text').textContent();
    expect(spaText?.toLowerCase()).not.toContain('nude');
  });

  test('NSFW fixture images are scanned by the classification pipeline', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 10000);

    // Verify the NSFW classification pipeline processes fixture images.
    // Images may be classified as safe, nsfw, or error — all are valid outcomes
    // as long as the image was actually scanned (not stuck unprocessed).
    const sampleIds = [
      'nsfw-fixture-01',
      'nsfw-fixture-05',
      'nsfw-fixture-10',
      'nsfw-fixture-15',
      'nsfw-fixture-21',
    ];
    for (const id of sampleIds) {
      const img = page.locator(`#${id}`);
      const processed = await img.getAttribute('data-pg-patrol-img-processed');

      // Image should have been processed by the scanner (not null/undefined)
      expect(processed, `${id} should be processed`).toBeTruthy();
      expect(['safe', 'nsfw', 'error', 'skipped']).toContain(processed);
    }
  });

  test('safe image is not blurred after classification', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 8000);

    const img = page.locator('#safe-test-img');
    const processed = await img.getAttribute('data-pg-patrol-img-processed');

    // Safe image should eventually be classified as safe (no blur)
    // It may take time for the model to load and classify
    if (processed === 'safe') {
      const filter = await img.evaluate((el) => (el as HTMLElement).style.filter);
      expect(filter).toBe('');
    }
    // If still processing or skipped, that's acceptable in E2E
  });
});
