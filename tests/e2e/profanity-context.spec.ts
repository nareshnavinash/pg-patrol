import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript } from './helpers';

test.describe('Profanity Context Window', () => {
  test('"beaver dam" not filtered', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#ctx-safe-1').textContent();
    expect(text).toContain('dam');
    expect(text).toContain('beaver');
  });

  test('"cockpit" not filtered', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#ctx-safe-2').textContent();
    expect(text).toContain('cockpit');
  });

  test('"Scunthorpe" not filtered', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#ctx-safe-4').textContent();
    expect(text).toContain('Scunthorpe');
  });

  test('actual profanity is still filtered', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#ctx-profane').textContent();
    expect(text).not.toContain('asshole');
  });

  test('safe word "assassin" is preserved', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#safe-word').textContent();
    expect(text).toContain('assassin');
  });
});
