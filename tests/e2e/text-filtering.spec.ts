import { test, expect } from './fixtures/extension';
import {
  TEST_PAGE,
  waitForContentScript,
  openPopup,
  addCustomWord,
  removeCustomWord,
} from './helpers';

test('replaces profanity on a static page', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  const text1 = await page.locator('#profanity-1').textContent();
  expect(text1).not.toContain('fuck');

  const text2 = await page.locator('#profanity-2').textContent();
  expect(text2).not.toContain('bullshit');

  const text3 = await page.locator('#profanity-3').textContent();
  expect(text3).not.toContain('asshole');
});

test('does not filter clean text', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  const clean1 = await page.locator('#clean-1').textContent();
  expect(clean1).toBe('This is a perfectly clean sentence.');

  const clean2 = await page.locator('#clean-2').textContent();
  expect(clean2).toBe('The weather is beautiful today.');
});

test('does not filter safe words (Scunthorpe problem)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  const safeText = await page.locator('#safe-word').textContent();
  expect(safeText).toContain('assassin');
});

test('filters dynamically added content', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  await page.click('#add-dynamic');
  await page.waitForTimeout(500);

  const dynamicText = await page.locator('#dynamic-profanity').textContent();
  expect(dynamicText).not.toContain('damn');
  expect(dynamicText).not.toContain('shit');
});

test('profane URL becomes clickable [link] element', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  const urlContainer = page.locator('#url-text');
  const containerText = await urlContainer.textContent();
  expect(containerText).not.toContain('shitpost');
});

test('newspaper page: all sections present and profanity replaced', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  const masthead = await page.locator('.masthead h1').textContent();
  expect(masthead).toContain('The Daily Patrol');

  const leadText = await page.locator('.lead-article').textContent();
  expect(leadText).not.toContain('fuck');
  expect(leadText).not.toContain('bullshit');
  expect(leadText).not.toContain('asshole');

  const sidebarText = await page.locator('.sidebar').textContent();
  expect(sidebarText).not.toContain('damn');
  expect(sidebarText).not.toContain('fucked');

  const commentsText = await page.locator('.comments-section').textContent();
  expect(commentsText).not.toContain('shit');
  expect(commentsText).not.toContain('bullshit');

  const safeArticle = await page.locator('#safe-word').textContent();
  expect(safeArticle).toContain('assassin');
});

test('Good Vibes Mode toggle visible in popup settings', async ({ context, extensionId }) => {
  const popup = await openPopup(context, extensionId);

  const goodVibesLabel = popup.locator('text=Good Vibes Mode');
  await expect(goodVibesLabel).toBeVisible();

  const wordFilterLabel = popup.locator('text=18+ Word Filter');
  await expect(wordFilterLabel).toBeVisible();
});

test('Good Vibes Mode hides negative news with overlay', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);

  const negativeNews1 = page.locator('#negative-news-1');
  const overlay1 = negativeNews1.locator('[data-pg-patrol-overlay-inner]');

  const hasOverlay = await overlay1.count() > 0 ||
    await negativeNews1.locator('p[data-pg-patrol-overlay]').count() > 0;

  const safeNews = page.locator('#safe-news-entertainment');
  const safeOverlay = safeNews.locator('[data-pg-patrol-overlay-inner]');
  const safeHasOverlay = await safeOverlay.count() > 0;
  expect(safeHasOverlay).toBe(false);
});

test('Good Vibes Mode: overlays are interactive with reveal text', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);

  // Overlays should exist on negative content
  const allOverlays = page.locator('[data-pg-patrol-overlay-inner]');
  const count = await allOverlays.count();
  expect(count).toBeGreaterThan(0);

  // Each overlay should have the reveal instruction text
  const firstOverlay = allOverlays.first();
  const text = await firstOverlay.textContent();
  expect(text).toContain('Hidden by PG Patrol');
  expect(text).toContain('Click to reveal');

  // Overlays should have pointer cursor (clickable)
  const cursor = await firstOverlay.evaluate(
    (el) => getComputedStyle(el).cursor,
  );
  expect(cursor).toBe('pointer');

  // Corresponding parent should have the overlay attribute
  const parentHasAttr = await firstOverlay.evaluate(
    (el) => el.parentElement?.getAttribute('data-pg-patrol-overlay') === 'true',
  );
  expect(parentHasAttr).toBe(true);
});

test('reveal toggle: button state changes on click', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);

  let text1 = await page.locator('#profanity-1').textContent();
  expect(text1).not.toContain('fuck');

  const popup = await openPopup(context, extensionId);

  // Verify reveal button exists and click it
  const revealBtn = popup.locator('button', { hasText: 'Reveal original content' });
  await expect(revealBtn).toBeVisible();
  await revealBtn.click();
  await popup.waitForTimeout(300);

  // Button text should change to indicate paused state
  const resumeBtn = popup.locator('button', { hasText: /resume/i });
  await expect(resumeBtn).toBeVisible();

  // Click resume
  await resumeBtn.click();
  await popup.waitForTimeout(300);

  // Button should revert to reveal state
  await expect(popup.locator('button', { hasText: 'Reveal original content' })).toBeVisible();
});

// ---- Custom Words Tests ----

test('custom blocked word is filtered after page reload', async ({ context, extensionId }) => {
  await addCustomWord(context, extensionId, 'bald', 'Blocked');

  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);

  const text = await page.locator('#custom-word-test-1').textContent();
  expect(text).not.toContain('bald');
});

test('custom blocked word applied to already-loaded page', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);

  let text = await page.locator('#custom-word-test-1').textContent();
  expect(text).toContain('bald');

  await addCustomWord(context, extensionId, 'bald', 'Blocked');
  await page.waitForTimeout(1500);

  text = await page.locator('#custom-word-test-1').textContent();
  expect(text).not.toContain('bald');
});

test('custom safe word prevents filtering', async ({ context, extensionId }) => {
  await addCustomWord(context, extensionId, 'pineapple', 'Blocked');
  await addCustomWord(context, extensionId, 'pineapple', 'Safe');

  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);

  const text = await page.locator('#custom-word-test-2').textContent();
  expect(text).toContain('pineapple');
});

test('removing custom blocked word restores original text', async ({ context, extensionId }) => {
  await addCustomWord(context, extensionId, 'bald', 'Blocked');

  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page, 1500);
  let text = await page.locator('#custom-word-test-1').textContent();
  expect(text).not.toContain('bald');

  await removeCustomWord(context, extensionId, 'bald', 'Blocked');
  await page.waitForTimeout(2000);

  text = await page.locator('#custom-word-test-1').textContent();
  expect(text).toContain('bald');
});

test('Good Vibes Mode is on by default', async ({ context, extensionId }) => {
  const popup = await openPopup(context, extensionId);

  const toggle = popup.locator('text=Good Vibes Mode').locator('../..').locator('button[role="switch"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});
