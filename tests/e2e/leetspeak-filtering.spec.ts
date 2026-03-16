import { test, expect } from './fixtures/extension';
import { TEST_PAGE, waitForContentScript } from './helpers';

test.describe('Leetspeak & Unicode Evasion Filtering', () => {
  test('filters sh1t leetspeak', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-1').textContent();
    expect(text).not.toContain('sh1t');
  });

  test('filters f*ck leetspeak', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-2').textContent();
    expect(text).not.toContain('f*ck');
  });

  test('filters a$$hole leetspeak', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-3').textContent();
    expect(text).not.toContain('a$$hole');
  });

  test('filters f_u_c_k_i_n_g separated chars', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-4').textContent();
    expect(text).not.toContain('f_u_c_k_i_n_g');
  });

  test('filters b!tch leetspeak', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-5').textContent();
    expect(text).not.toContain('b!tch');
  });

  test('preserves clean text with numbers and symbols', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    const text = await page.locator('#leet-clean').textContent();
    expect(text).toBe('Normal text with numbers like 4 and symbols like @ should stay');
  });

  test('filters dynamically added leetspeak', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    await page.click('#add-dynamic-leet');
    await page.waitForTimeout(500);

    const text = await page.locator('#dynamic-leet').textContent();
    expect(text).not.toContain('sh1t');
    expect(text).not.toContain('f*ck');
  });

  test('sidebar leetspeak article is filtered', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(TEST_PAGE);
    await waitForContentScript(page);

    // The Internet Culture article card contains "sh1t" and "f*ck"
    const articleCards = page.locator('.article-card');
    const leetspeakCard = articleCards.filter({ hasText: 'Creative Spelling' });
    const cardText = await leetspeakCard.textContent();
    expect(cardText).not.toContain('sh1t');
    expect(cardText).not.toContain('f*ck');
  });
});
