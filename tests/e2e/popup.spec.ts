import { test, expect } from './fixtures/extension';

test('popup opens and shows PG Patrol', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

  // Wait for the popup to finish loading (useStorage hook resolves)
  await expect(page.getByRole('heading', { name: 'PG Patrol' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Family-friendly filter')).toBeVisible();
});
