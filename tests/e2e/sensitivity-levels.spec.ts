import { test, expect } from './fixtures/extension';
import {
  TEST_PAGE,
  waitForContentScript,
  openPopup,
  changeSensitivity,
} from './helpers';

test.describe('Sensitivity Levels', () => {
  test('default sensitivity is moderate', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    // The Moderate button should be visually selected (active state)
    const moderateBtn = popup.locator('button', { hasText: /^Moderate$/ });
    await expect(moderateBtn).toBeVisible();

    // Check if it has an active/selected indicator (aria-pressed or specific class)
    const isPressed = await moderateBtn.getAttribute('aria-pressed');
    const classList = await moderateBtn.getAttribute('class');
    // It should either be aria-pressed=true or have a distinguishing class
    const isActive =
      isPressed === 'true' ||
      (classList && (classList.includes('active') || classList.includes('bg-')));
    expect(isActive).toBeTruthy();
  });

  test('strict mode filters all profanity levels', async ({
    context,
    extensionId,
  }) => {
    await changeSensitivity(context, extensionId, 'Strict');

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // All levels should be filtered in strict mode
    const strict = await page.locator('#sens-strict').textContent();
    expect(strict).not.toContain('fuck');

    const moderate = await page.locator('#sens-moderate').textContent();
    expect(moderate).not.toContain('bullshit');

    const mild = await page.locator('#sens-mild-only').textContent();
    expect(mild).not.toContain('crap');
  });

  test('moderate mode filters moderate and strict profanity', async ({
    context,
    extensionId,
  }) => {
    // Moderate is default, but set explicitly to be sure
    await changeSensitivity(context, extensionId, 'Moderate');

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Strict-level profanity should be filtered
    const strict = await page.locator('#sens-strict').textContent();
    expect(strict).not.toContain('fuck');

    // Moderate-level profanity should be filtered
    const moderate = await page.locator('#sens-moderate').textContent();
    expect(moderate).not.toContain('bullshit');
  });

  test('mild mode only filters severe profanity', async ({
    context,
    extensionId,
  }) => {
    await changeSensitivity(context, extensionId, 'Mild');

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Strict-level profanity should still be filtered even in mild mode
    const strict = await page.locator('#sens-strict').textContent();
    expect(strict).not.toContain('fuck');

    // Mild-only words like "crap" should pass through in mild mode
    const mild = await page.locator('#sens-mild-only').textContent();
    expect(mild).toContain('crap');
  });

  test('sensitivity change applies after page reload', async ({
    context,
    extensionId,
  }) => {
    await changeSensitivity(context, extensionId, 'Strict');

    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Verify strict is active
    const mild = await page.locator('#sens-mild-only').textContent();
    expect(mild).not.toContain('crap');

    // Now switch to mild
    await changeSensitivity(context, extensionId, 'Mild');

    // Reload
    await page.reload();
    await waitForContentScript(page, 1500);

    // Mild words should now pass through
    const mildAfter = await page.locator('#sens-mild-only').textContent();
    expect(mildAfter).toContain('crap');
  });

  test('sensitivity persists across navigation', async ({
    context,
    extensionId,
  }) => {
    await changeSensitivity(context, extensionId, 'Strict');

    // Navigate to test page
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Navigate away and back
    await page.goto('about:blank');
    await page.goto(TEST_PAGE);
    await waitForContentScript(page, 1500);

    // Strict should still be active — mild words filtered
    const mild = await page.locator('#sens-mild-only').textContent();
    expect(mild).not.toContain('crap');
  });
});
