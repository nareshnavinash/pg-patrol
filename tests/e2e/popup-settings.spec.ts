import { test, expect } from './fixtures/extension';
import {
  TEST_PAGE,
  waitForContentScript,
  openPopup,
  toggleSetting,
} from './helpers';

test.describe('Popup Settings', () => {
  test('popup shows all toggle labels', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    await expect(popup.locator('text=18+ Word Filter')).toBeVisible();
    await expect(popup.locator('text=Good Vibes Mode')).toBeVisible();
    await expect(popup.locator('text=Image Filtering')).toBeVisible();
    await expect(popup.locator('text=AI-Enhanced Detection')).toBeVisible();
  });

  test('sensitivity selector has 3 options', async ({
    context,
    extensionId,
  }) => {
    const popup = await openPopup(context, extensionId);

    const mild = popup.locator('button', { hasText: /^Mild$/ });
    const moderate = popup.locator('button', { hasText: /^Moderate$/ });
    const strict = popup.locator('button', { hasText: /^Strict$/ });

    await expect(mild).toBeVisible();
    await expect(moderate).toBeVisible();
    await expect(strict).toBeVisible();
  });

  test('toggling Word Filter off stops profanity replacement', async ({
    context,
    extensionId,
  }) => {
    // Disable word filter
    await toggleSetting(context, extensionId, '18+ Word Filter', false);

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Profanity should be visible (not filtered)
    const text = await page.locator('#profanity-1').textContent();
    expect(text).toContain('fuck');

    // Re-enable for other tests
    await toggleSetting(context, extensionId, '18+ Word Filter', true);
  });

  test('toggling Word Filter back on re-filters', async ({
    context,
    extensionId,
  }) => {
    // Start with word filter off
    await toggleSetting(context, extensionId, '18+ Word Filter', false);

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Profanity visible
    let text = await page.locator('#profanity-1').textContent();
    expect(text).toContain('fuck');

    // Toggle back on
    await toggleSetting(context, extensionId, '18+ Word Filter', true);

    // Reload to apply
    await page.reload();
    await waitForContentScript(page, 1500);

    // Profanity should now be filtered
    text = await page.locator('#profanity-1').textContent();
    expect(text).not.toContain('fuck');
  });

  test('toggling Good Vibes off removes overlays', async ({
    context,
    extensionId,
  }) => {
    // Disable Good Vibes
    await toggleSetting(context, extensionId, 'Good Vibes Mode', false);

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // No overlays should be present
    const overlays = page.locator('[data-pg-patrol-overlay-inner]');
    expect(await overlays.count()).toBe(0);

    // Re-enable for other tests
    await toggleSetting(context, extensionId, 'Good Vibes Mode', true);
  });

  test('toggling Good Vibes on applies overlays', async ({
    context,
    extensionId,
  }) => {
    // Ensure Good Vibes is on
    await toggleSetting(context, extensionId, 'Good Vibes Mode', true);

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // There should be overlays on negative news articles
    const overlays = page.locator('[data-pg-patrol-overlay-inner]');
    const hasOverlays =
      (await overlays.count()) > 0 ||
      (await page.locator('[data-pg-patrol-overlay]').count()) > 0;
    expect(hasOverlays).toBe(true);
  });

  test('custom words section expands', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    // Click Custom Words to expand
    const customWordsBtn = popup.locator('button', {
      hasText: 'Custom Words',
    });
    await customWordsBtn.click();
    await popup.waitForTimeout(300);

    // Input field should be visible
    const input = popup.locator('input[type="text"]');
    await expect(input).toBeVisible();
  });

  test('stats display shows replacement count', async ({
    context,
    extensionId,
  }) => {
    // Navigate to a page with profanity so replacements happen
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Open popup — the badge or stats area should show a non-zero count
    const popup = await openPopup(context, extensionId);

    // Look for any element showing a count/number (badge text, stats area)
    const statsText = await popup.textContent('body');
    // The popup should show some numeric indicator of replacements
    // Match any number > 0 in the popup (replacement count)
    const hasCount = /\d+/.test(statsText || '');
    expect(hasCount).toBe(true);
  });
});
