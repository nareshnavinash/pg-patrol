import type { BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEST_PAGE = `file://${path.resolve(__dirname, 'fixtures/test-page.html')}`;

export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.waitForTimeout(500);
  return popup;
}

export async function waitForContentScript(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function navigateToTestPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(TEST_PAGE);
  await waitForContentScript(page);
  return page;
}

export async function changeSensitivity(
  context: BrowserContext,
  extensionId: string,
  level: 'Mild' | 'Moderate' | 'Strict',
): Promise<void> {
  const popup = await openPopup(context, extensionId);
  const btn = popup.locator('button', { hasText: new RegExp(`^${level}$`) });
  await btn.click();
  await popup.waitForTimeout(300);
  await popup.close();
}

export async function toggleSetting(
  context: BrowserContext,
  extensionId: string,
  label: string,
  enable: boolean,
): Promise<void> {
  const popup = await openPopup(context, extensionId);
  const toggle = popup.locator(`text=${label}`).locator('../..').locator('button[role="switch"]');
  const currentState = await toggle.getAttribute('aria-checked');
  const isEnabled = currentState === 'true';
  if (isEnabled !== enable) {
    await toggle.click();
    await popup.waitForTimeout(300);
  }
  await popup.close();
}

export async function addCustomWord(
  context: BrowserContext,
  extensionId: string,
  word: string,
  category: 'Blocked' | 'Safe' = 'Blocked',
): Promise<void> {
  const popup = await openPopup(context, extensionId);

  const customWordsBtn = popup.locator('button', { hasText: 'Custom Words' });
  await customWordsBtn.click();
  await popup.waitForTimeout(300);

  const tabBtn = popup.locator('button', {
    hasText: new RegExp(`^${category}`),
  });
  await tabBtn.click();
  await popup.waitForTimeout(200);

  // Use evaluate to set input value — Preact controlled inputs
  // don't reliably respond to Playwright's fill/type methods
  await popup.evaluate((w) => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(input, w);
    } else {
      input.value = w;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, word);
  await popup.waitForTimeout(300);
  const addBtn = popup.locator('button', { hasText: 'Add' });
  await addBtn.click();
  await popup.waitForTimeout(300);

  await popup.close();
}

export async function removeCustomWord(
  context: BrowserContext,
  extensionId: string,
  word: string,
  category: 'Blocked' | 'Safe' = 'Blocked',
): Promise<void> {
  const popup = await openPopup(context, extensionId);

  const customWordsBtn = popup.locator('button', { hasText: 'Custom Words' });
  await customWordsBtn.click();
  await popup.waitForTimeout(300);

  const tabBtn = popup.locator('button', {
    hasText: new RegExp(`^${category}`),
  });
  await tabBtn.click();
  await popup.waitForTimeout(200);

  const removeBtn = popup.locator(`button[aria-label="Remove ${word}"]`);
  await removeBtn.click();
  await popup.waitForTimeout(300);

  await popup.close();
}
