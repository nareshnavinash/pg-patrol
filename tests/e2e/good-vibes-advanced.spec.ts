import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript } from './helpers';

test.describe('Good Vibes Mode — N-gram & Negation', () => {
  // Good Vibes Mode is ON by default

  test('n-gram safe: "killed it" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#ngram-safe-1');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);

    const text = await el.textContent();
    expect(text).toContain('killed it');
  });

  test('n-gram safe: "shooting stars" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#ngram-safe-2');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);

    const text = await el.textContent();
    expect(text).toContain('shooting stars');
  });

  test('n-gram safe: "Star Wars" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#ngram-safe-3');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);

    const text = await el.textContent();
    expect(text).toContain('Star Wars');
  });

  test('n-gram safe: "crash course" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#ngram-safe-4');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);

    const text = await el.textContent();
    expect(text).toContain('crash course');
  });

  test('n-gram negative: bombing content is blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#ngram-negative');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    const hasOverlay =
      (await overlay.count()) > 0 ||
      (await el.locator('[data-pg-patrol-overlay]').count()) > 0;
    expect(hasOverlay).toBe(true);
  });

  test('negation safe: "not violent" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#negation-safe-1');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);
  });

  test('negation safe: "never terrorist" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#negation-safe-2');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);
  });

  test('negation safe: "no casualties" not blocked', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#negation-safe-3');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlay.count()).toBe(0);
  });

  test('negation negative: actual violence is blocked', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    const el = page.locator('#negation-negative');
    const overlay = el.locator('[data-pg-patrol-overlay-inner]');
    const hasOverlay =
      (await overlay.count()) > 0 ||
      (await el.locator('[data-pg-patrol-overlay]').count()) > 0;
    expect(hasOverlay).toBe(true);
  });

  test('dynamic negative content gets overlay', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    await page.click('#add-dynamic-negative');
    // Give observer + blockScan more time to process the new element
    await page.waitForTimeout(2000);

    // The overlay might be on the article, or on the p child, or a wrapping div
    const el = page.locator('#dynamic-negative');
    const overlayInner = el.locator('[data-pg-patrol-overlay-inner]');
    const overlayAttr = el.locator('[data-pg-patrol-overlay]');
    const blurWrap = el.locator('[data-pg-patrol-blur-wrap]');

    // Check within the dynamic element or on the element itself
    const hasOverlay =
      (await overlayInner.count()) > 0 ||
      (await overlayAttr.count()) > 0 ||
      (await blurWrap.count()) > 0 ||
      (await el.getAttribute('data-pg-patrol-overlay')) !== null;
    expect(hasOverlay).toBe(true);
  });
});
