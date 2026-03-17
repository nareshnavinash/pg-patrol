/**
 * PG Patrol Demo Video Recorder
 *
 * Records an automated demo of the extension using Playwright's built-in video recording.
 * Requires: npm run build:chrome (the dist/ folder must exist)
 *
 * Usage: npx tsx scripts/record-demo.ts
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_PATH = path.resolve(__dirname, '../dist');
const DEMO_DIR = path.resolve(__dirname, '../tests/e2e/demo');
const OUTPUT_DIR = path.resolve(__dirname, '../demo-output');

const VIDEO_SIZE = { width: 1280, height: 720 };

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchWithExtension(): Promise<{ context: BrowserContext; extensionId: string }> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
      `--window-size=${VIDEO_SIZE.width},${VIDEO_SIZE.height}`,
    ],
    viewport: VIDEO_SIZE,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIDEO_SIZE,
    },
  });

  // Wait for service worker to register and extract extension ID
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];

  return { context, extensionId };
}

async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await sleep(800);
  return popup;
}

async function waitForContentScript(page: Page, ms = 2000): Promise<void> {
  await sleep(ms);
}

// ──────────────────────────────────────────────
// Scene 1: Profanity Filtering (~7s)
// ──────────────────────────────────────────────
async function sceneProfanity(context: BrowserContext) {
  console.log('Scene 1: Profanity filtering...');
  const page = await context.newPage();
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await waitForContentScript(page, 3000);

  // Scroll through the feed slowly to show replacements
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1000);

  await page.close();
}

// ──────────────────────────────────────────────
// Scene 2: Popup & Stats (~8s)
// ──────────────────────────────────────────────
async function scenePopup(context: BrowserContext, extensionId: string) {
  console.log('Scene 2: Popup & stats...');
  const popup = await openPopup(context, extensionId);

  // Let user see the stats and current settings
  await sleep(2000);

  // Scroll down to show more settings
  await popup.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 200, behavior: 'smooth' });
  });
  await sleep(2000);

  // Scroll back up
  await popup.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await sleep(1500);

  await popup.close();
}

// ──────────────────────────────────────────────
// Scene 3: NSFW Image Blocking (~8s)
// ──────────────────────────────────────────────
async function sceneImages(context: BrowserContext) {
  console.log('Scene 3: NSFW image blocking...');
  const page = await context.newPage();
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-images.html')}`);

  // Wait for image scanning (ML model needs time)
  await waitForContentScript(page, 4000);

  // Scroll to the NSFW gallery section
  await page.evaluate(() => {
    const gallery = document.getElementById('nsfw-gallery');
    if (gallery) gallery.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await sleep(3000);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1000);

  await page.close();
}

// ──────────────────────────────────────────────
// Scene 4: Good Vibes Mode (~8s)
// ──────────────────────────────────────────────
async function sceneGoodVibes(context: BrowserContext) {
  console.log('Scene 4: Good Vibes mode...');
  const page = await context.newPage();
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-negative.html')}`);
  await waitForContentScript(page, 3000);

  // Scroll through negative articles to show overlays
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'smooth' }));
  await sleep(1500);

  await page.close();
}

// ──────────────────────────────────────────────
// Scene 5: Activity Log (~7s)
// ──────────────────────────────────────────────
async function sceneActivityLog(context: BrowserContext, extensionId: string) {
  console.log('Scene 5: Activity log...');
  const popup = await openPopup(context, extensionId);

  // Look for and click Activity Log or scroll to see logged items
  await sleep(1500);

  // Try to expand activity log if there's a collapsible section
  const activityBtn = popup.locator('button', { hasText: /Activity/i });
  if ((await activityBtn.count()) > 0) {
    await activityBtn.first().click();
    await sleep(2000);
  }

  await sleep(1500);
  await popup.close();
}

// ──────────────────────────────────────────────
// Scene 6: Privacy Callout (~5s)
// ──────────────────────────────────────────────
async function scenePrivacy(context: BrowserContext, extensionId: string) {
  console.log('Scene 6: Privacy callout...');
  const popup = await openPopup(context, extensionId);

  // Scroll to bottom of popup to show privacy info
  await popup.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
  });
  await sleep(3000);

  await popup.close();
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  console.log('Starting PG Patrol demo recording...');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  const { context, extensionId } = await launchWithExtension();

  try {
    // Close default blank page
    const pages = context.pages();
    for (const p of pages) {
      if (p.url() === 'about:blank') await p.close();
    }

    await sceneProfanity(context);
    await scenePopup(context, extensionId);
    await sceneImages(context);
    await sceneGoodVibes(context);
    await sceneActivityLog(context, extensionId);
    await scenePrivacy(context, extensionId);

    console.log('');
    console.log('Recording complete! Closing browser...');
  } finally {
    await context.close();
  }

  console.log(`Videos saved to: ${OUTPUT_DIR}`);
  console.log('');
  console.log('Next step: run scripts/demo-to-mp4.sh to convert and combine videos.');
}

main().catch((err) => {
  console.error('Demo recording failed:', err);
  process.exit(1);
});
