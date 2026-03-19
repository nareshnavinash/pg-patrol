/**
 * PG Patrol Store Screenshot Capture
 *
 * Captures 6 store screenshots (1280x800) and 2 promotional tiles
 * using Playwright with the extension loaded.
 *
 * Requires: npm run build:chrome (the dist/ folder must exist)
 * Usage: npx tsx scripts/capture-screenshots.ts
 */

import { chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_PATH = path.resolve(__dirname, '../dist');
const DEMO_DIR = path.resolve(__dirname, '../tests/e2e/demo');
const OUTPUT_DIR = path.resolve(__dirname, '../store-assets/screenshots');
const STORE_ASSETS_DIR = path.resolve(__dirname, '../store-assets');

const SCREENSHOT_SIZE = { width: 1280, height: 800 };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Browser Launchers ──────────────────────────

async function launchWithExtension(): Promise<{ context: BrowserContext; extensionId: string }> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
      `--window-size=${SCREENSHOT_SIZE.width},${SCREENSHOT_SIZE.height}`,
    ],
    viewport: SCREENSHOT_SIZE,
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];

  // Mark onboarding as seen so popup shows the main UI
  // The app uses chrome.storage.sync with key "settings" as a plain object
  const setupPage = await context.newPage();
  await setupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await sleep(500);
  await setupPage.evaluate(() => {
    return chrome.storage.sync.set({
      settings: {
        enabled: true,
        sensitivity: 'moderate',
        textFilterEnabled: true,
        imageFilterEnabled: true,
        positiveModeEnabled: true,
        mlClassifierEnabled: true,
        developerMode: false,
        customThreshold: 0.1,
        hasSeenOnboarding: true,
        whitelistedSites: [],
        customBlockedWords: [],
        customSafeWords: [],
        customNegativeTriggers: [],
        customSafeContext: [],
        perspectiveApiKey: '',
        stats: { totalWordsReplaced: 247, totalImagesReplaced: 12 },
      },
    });
  });
  // Reload popup to pick up the new settings
  await setupPage.reload({ waitUntil: 'networkidle' });
  await sleep(1000);
  await setupPage.close();

  return { context, extensionId };
}

async function launchWithoutExtension(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [`--window-size=${SCREENSHOT_SIZE.width},${SCREENSHOT_SIZE.height}`],
  });
}

// ── Utility: Capture Popup ──────────────────────

async function capturePopup(
  context: BrowserContext,
  extensionId: string,
  options?: { scrollToSettings?: boolean },
): Promise<Buffer> {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 540 });
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await sleep(1500);

  if (options?.scrollToSettings) {
    // Settings CollapsibleSection has defaultOpen={true}, so it should already be expanded.
    // We just need to scroll down so the sensitivity selector is visible.
    // First, ensure the Settings section is expanded (click trigger only if collapsed).
    await popup.evaluate(() => {
      const triggers = document.querySelectorAll('button[aria-expanded]');
      for (const trigger of triggers) {
        if (
          trigger.textContent?.includes('Settings') &&
          trigger.getAttribute('aria-expanded') === 'false'
        ) {
          (trigger as HTMLElement).click();
        }
      }
    });
    await sleep(500);

    // Scroll to the sensitivity label so toggles + sensitivity selector are centered
    await popup.evaluate(() => {
      // Find the "Sensitivity" label inside the settings section
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent?.includes('Sensitivity')) {
          label.scrollIntoView({ behavior: 'instant', block: 'center' });
          return;
        }
      }
      // Fallback: scroll the settings trigger into view
      const triggers = document.querySelectorAll('button[aria-expanded]');
      for (const trigger of triggers) {
        if (trigger.textContent?.includes('Settings')) {
          (trigger as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'start' });
          return;
        }
      }
    });
    await sleep(500);
  }

  const screenshot = await popup.screenshot({ type: 'png' });
  await popup.close();
  return Buffer.from(screenshot);
}

// ── Utility: Composite via HTML Template ──────

async function compositeScreenshots(
  context: BrowserContext,
  html: string,
  size: { width: number; height: number },
  outputPath: string,
): Promise<void> {
  const page = await context.newPage();
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await sleep(500);
  await page.screenshot({ path: outputPath, type: 'png' });
  await page.close();
}

// ── Word highlight helpers ──────────────────────

// Profanity words present in the demo-profanity.html visible viewport (used by buildHighlightScript)
const _PROFANITY_WORDS = [
  'shitshow',
  'damn',
  'fucking',
  'kidding me',
  'shit',
  'sucks ass',
  'crap',
  'asshole',
  'hell',
  'idiot',
  'damn',
  'bullshit',
  'damn',
  'shit',
  'fucking',
  'holy shit',
  'damn',
  'piss poor',
];

// Highlight matching words in text nodes inside .post-body and .comment-text elements
function buildHighlightScript(words: string[], color: 'red' | 'green') {
  const bg =
    color === 'red'
      ? 'rgba(239,68,68,0.2)' // mild red
      : 'rgba(34,197,94,0.2)'; // mild green
  const border =
    color === 'red' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(34,197,94,0.4)';

  return `
    (function() {
      const words = ${JSON.stringify(words)};
      const containers = document.querySelectorAll('.post-body, .comment-text');

      containers.forEach(container => {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
          const text = node.textContent;
          if (!text) return;

          // Build regex from words, case-insensitive
          const escaped = words.map(w => w.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'));
          const regex = new RegExp('(' + escaped.join('|') + ')', 'gi');

          if (!regex.test(text)) return;
          regex.lastIndex = 0;

          const frag = document.createDocumentFragment();
          let lastIndex = 0;
          let match;
          while ((match = regex.exec(text)) !== null) {
            // Text before match
            if (match.index > lastIndex) {
              frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            // Highlighted match
            const mark = document.createElement('mark');
            mark.textContent = match[1];
            mark.style.cssText = 'background: ${bg}; border: ${border}; border-radius: 3px; padding: 1px 2px;';
            frag.appendChild(mark);
            lastIndex = regex.lastIndex;
          }
          if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
          }
          node.parentNode.replaceChild(frag, node);
        });
      });
    })();
  `;
}

// ── Screenshot 1: Before vs After ──────────────

async function captureBeforeAfter(extContext: BrowserContext, _extensionId: string): Promise<void> {
  console.log('  Screenshot 1: Before vs After — Text Filtering');

  // ── "Before" side: highlight profanity in red ──
  const browser = await launchWithoutExtension();
  const beforePage = await browser.newPage();
  await beforePage.setViewportSize({ width: 640, height: 800 });
  await beforePage.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await sleep(1000);

  // Highlight profanity words with mild red
  const profanityInPage = [
    'shitshow',
    'damn',
    'fucking kidding',
    'shit',
    'sucks ass',
    'crap',
    'asshole',
    'hell',
    'idiot',
    'damn',
    'bullshit',
    'damn',
    'shit',
    'fucking',
    'holy shit',
    'damn',
    'piss poor',
  ];
  await beforePage.evaluate(buildHighlightScript(profanityInPage, 'red'));
  await sleep(300);
  const beforeBuf = await beforePage.screenshot({ type: 'png' });
  await beforePage.close();
  await browser.close();

  // ── "After" side: extension filters, then highlight replacements in green ──
  const afterPage = await extContext.newPage();
  await afterPage.setViewportSize({ width: 640, height: 800 });
  await afterPage.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await sleep(3000); // Wait for content script to filter

  // Collect the funny replacement words that appeared
  // We do this by comparing with known funny-word patterns
  await afterPage.evaluate(`
    (function() {
      // Known funny replacement words from the extension's funny-words.json
      const funnyWords = [
        'applesauce', 'avocado toast', 'artichoke', 'armadillo', 'acorns',
        'banana splits', 'butterscotch', 'biscuits', 'bubblegum', 'broccoli', 'bumbleberry',
        'crumbs', 'cupcakes', 'cotton candy', 'coconuts', 'cinnamon sticks', 'cheese wheels',
        'doodlebug', 'dagnabbit', 'donut holes', 'dingleberry', 'dumplings',
        'fiddlesticks', 'fluffernutter', 'flapjacks', 'fudgesicle', 'french toast', 'fig newtons',
        'gummy bears', 'gingerbread', 'gumdrop',
        'honey buns', 'hot cocoa', 'huckleberry',
        'ice cream', 'icicle pop',
        'jellybean', 'jelly donut',
        'kiwi fruit', 'kumquat',
        'lollipop', 'licorice', 'lemon drop',
        'marshmallow', 'muffin top', 'mango smoothie',
        'noodle', 'nutmeg',
        'oh fiddlesticks', 'good gravy', 'holy moly', 'jeepers creepers',
        'oh snap', 'great googly moogly', 'son of a biscuit',
        'what the fudge', 'cheese and crackers', 'oh my stars',
        'pancakes', 'pickle juice', 'popsicle', 'pudding cup',
        'sugar plums', 'snickerdoodle', 'sassafras', 'silly goose', 'sprinkles', 'sweet potato',
        'tater tots', 'taffy', 'tootsie roll',
        'waffle cone', 'waffles',
      ];

      const bg = 'rgba(34,197,94,0.2)';
      const border = '1px solid rgba(34,197,94,0.4)';

      const containers = document.querySelectorAll('.post-body, .comment-text');
      containers.forEach(container => {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
          const text = node.textContent;
          if (!text) return;

          const escaped = funnyWords.map(w => w.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'));
          const regex = new RegExp('(' + escaped.join('|') + ')', 'gi');

          if (!regex.test(text)) return;
          regex.lastIndex = 0;

          const frag = document.createDocumentFragment();
          let lastIndex = 0;
          let match;
          while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
              frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const mark = document.createElement('mark');
            mark.textContent = match[1];
            mark.style.cssText = 'background: ' + bg + '; border: ' + border + '; border-radius: 3px; padding: 1px 2px;';
            frag.appendChild(mark);
            lastIndex = regex.lastIndex;
          }
          if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
          }
          node.parentNode.replaceChild(frag, node);
        });
      });
    })();
  `);
  await sleep(300);
  const afterBuf = await afterPage.screenshot({ type: 'png' });
  await afterPage.close();

  // Composite side by side
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1280px; height: 800px; display: flex; font-family: -apple-system, sans-serif; background: #f5f5f5; }
  .half { width: 640px; height: 800px; position: relative; overflow: hidden; }
  .half img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .label {
    position: absolute; top: 0; left: 0; right: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
    padding: 16px 24px;
    font-size: 22px; font-weight: 800; color: white;
    letter-spacing: 1px; text-transform: uppercase;
    text-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .label.before { background: linear-gradient(180deg, rgba(220,38,38,0.85) 0%, transparent 100%); }
  .label.after { background: linear-gradient(180deg, rgba(34,197,94,0.85) 0%, transparent 100%); }
  .divider {
    position: absolute; top: 0; bottom: 0; left: 639px;
    width: 2px; background: white; z-index: 10;
    box-shadow: 0 0 8px rgba(0,0,0,0.3);
  }
</style></head><body>
  <div class="half">
    <img src="data:image/png;base64,${Buffer.from(beforeBuf).toString('base64')}">
    <div class="label before">Before</div>
  </div>
  <div class="divider"></div>
  <div class="half">
    <img src="data:image/png;base64,${Buffer.from(afterBuf).toString('base64')}">
    <div class="label after">After — PG Patrol</div>
  </div>
</body></html>`;

  await compositeScreenshots(
    extContext,
    html,
    SCREENSHOT_SIZE,
    path.join(OUTPUT_DIR, '01-before-after-text.png'),
  );
}

// ── Screenshot 2: Text Filtering + Popup ──────

async function captureTextWithPopup(
  extContext: BrowserContext,
  extensionId: string,
): Promise<void> {
  console.log('  Screenshot 2: Text Filtering + Popup');

  // Full page with extension active
  const page = await extContext.newPage();
  await page.setViewportSize(SCREENSHOT_SIZE);
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await sleep(3000);
  const pageBuf = await page.screenshot({ type: 'png' });
  await page.close();

  // Capture popup
  const popupBuf = await capturePopup(extContext, extensionId);

  // Composite with popup floating top-right
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1280px; height: 800px; position: relative; overflow: hidden; }
  .bg { width: 100%; height: 100%; object-fit: cover; }
  .popup-frame {
    position: absolute; top: 24px; right: 24px;
    width: 320px;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  .popup-frame img { width: 100%; display: block; }
  .popup-chrome {
    background: #dee1e6; padding: 6px 12px;
    display: flex; align-items: center; gap: 6px;
    font-family: -apple-system, sans-serif; font-size: 11px; color: #555;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-r { background: #ff5f57; }
  .dot-y { background: #ffbd2e; }
  .dot-g { background: #28c840; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${Buffer.from(pageBuf).toString('base64')}">
  <div class="popup-frame">
    <div class="popup-chrome">
      <span class="dot dot-r"></span>
      <span class="dot dot-y"></span>
      <span class="dot dot-g"></span>
      <span style="margin-left:4px">PG Patrol</span>
    </div>
    <img src="data:image/png;base64,${Buffer.from(popupBuf).toString('base64')}">
  </div>
</body></html>`;

  await compositeScreenshots(
    extContext,
    html,
    SCREENSHOT_SIZE,
    path.join(OUTPUT_DIR, '02-text-filtering-popup.png'),
  );
}

// ── Screenshot 3: NSFW Image Blocking (Before/After) ──────────
// Uses a custom 2x2 grid composite for perfect center alignment on both sides.

async function captureImageBlocking(
  extContext: BrowserContext,
  _extensionId: string,
): Promise<void> {
  console.log('  Screenshot 3: NSFW Image Blocking (Before/After)');

  // Read 4 NSFW fixture images as base64 for the "before" blurred side
  const fixtureFiles = [
    'nsfw-fixture-01.png',
    'nsfw-fixture-02.png',
    'nsfw-fixture-03.png',
    'nsfw-fixture-04.png',
  ];
  const fixtureB64 = fixtureFiles.map((f) => {
    const buf = fs.readFileSync(path.join(__dirname, '../tests/e2e/fixtures', f));
    return buf.toString('base64');
  });

  // Get 4 replacement images as base64 for the "after" side
  const replacementFiles = [
    'square/panda-eating.webp',
    'square/puppy-golden.webp',
    'square/kittens-playing.webp',
    'square/hedgehog-cute.webp',
  ];
  const replacementB64 = replacementFiles.map((f) => {
    const buf = fs.readFileSync(path.join(__dirname, '../src/assets/replacements', f));
    const ext = f.endsWith('.webp') ? 'webp' : 'png';
    return { data: buf.toString('base64'), mime: `image/${ext}` };
  });

  // Build a single self-contained HTML composite at 1280x800
  const html = `<!DOCTYPE html>
<html><head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px; height: 800px;
    display: flex;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f0f0f0;
  }

  .half {
    width: 640px; height: 800px;
    position: relative;
    display: flex; flex-direction: column;
    align-items: center;
  }

  .label {
    width: 100%; padding: 18px 24px;
    font-size: 20px; font-weight: 800; color: white;
    letter-spacing: 1px; text-transform: uppercase;
    text-shadow: 0 2px 6px rgba(0,0,0,0.3);
    text-align: center;
  }
  .label.before { background: linear-gradient(135deg, #dc2626, #b91c1c); }
  .label.after { background: linear-gradient(135deg, #16a34a, #15803d); }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 20px 32px;
    flex: 1;
    align-content: center;
  }

  .cell {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    aspect-ratio: 1;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .cell img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Before: blurred images */
  .cell.blurred img {
    filter: blur(18px) brightness(0.55);
    transform: scale(1.15);
  }
  .nsfw-badge {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 8px; z-index: 5;
  }
  .nsfw-badge .icon { font-size: 40px; }
  .nsfw-badge .tag {
    background: rgba(220,38,38,0.9); color: white;
    padding: 5px 16px; border-radius: 5px;
    font-size: 13px; font-weight: 800;
    letter-spacing: 2px; text-transform: uppercase;
  }

  /* After: replacement images */
  .cell.replaced { border: 3px solid rgba(34,197,94,0.5); }

  .divider {
    position: absolute; top: 0; bottom: 0; left: 639px;
    width: 2px; background: white; z-index: 10;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
  }
</style>
</head>
<body>
  <!-- Before side -->
  <div class="half" style="background: #e8e8e8;">
    <div class="label before">Before</div>
    <div class="grid">
      ${fixtureB64
        .map(
          (b64) => `
        <div class="cell blurred">
          <img src="data:image/png;base64,${b64}">
          <div class="nsfw-badge">
            <span class="icon">&#9888;&#65039;</span>
            <span class="tag">NSFW</span>
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  </div>

  <div class="divider"></div>

  <!-- After side -->
  <div class="half" style="background: #f0faf4;">
    <div class="label after">After &mdash; PG Patrol</div>
    <div class="grid">
      ${replacementB64
        .map(
          (r) => `
        <div class="cell replaced">
          <img src="data:image/${r.mime};base64,${r.data}">
        </div>
      `,
        )
        .join('')}
    </div>
  </div>
</body></html>`;

  await compositeScreenshots(
    extContext,
    html,
    SCREENSHOT_SIZE,
    path.join(OUTPUT_DIR, '03-nsfw-image-blocking.png'),
  );
}

// ── Screenshot 4: Good Vibes Mode ──────────────

async function captureGoodVibes(extContext: BrowserContext): Promise<void> {
  console.log('  Screenshot 4: Good Vibes Mode');

  const page = await extContext.newPage();
  await page.setViewportSize(SCREENSHOT_SIZE);
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-negative.html')}`);
  await sleep(3000); // Wait for content script to apply overlays

  await page.screenshot({
    path: path.join(OUTPUT_DIR, '04-good-vibes-mode.png'),
    type: 'png',
  });
  await page.close();
}

// ── Screenshot 5: Settings & Sensitivity ───────

async function captureSettings(extContext: BrowserContext, extensionId: string): Promise<void> {
  console.log('  Screenshot 5: Settings & Sensitivity');

  // Full page with extension active
  const page = await extContext.newPage();
  await page.setViewportSize(SCREENSHOT_SIZE);
  await page.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await sleep(3000);
  const pageBuf = await page.screenshot({ type: 'png' });
  await page.close();

  // Capture popup scrolled to Settings
  const popupBuf = await capturePopup(extContext, extensionId, { scrollToSettings: true });

  // Composite with popup floating top-right
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1280px; height: 800px; position: relative; overflow: hidden; }
  .bg { width: 100%; height: 100%; object-fit: cover; }
  .popup-frame {
    position: absolute; top: 24px; right: 24px;
    width: 320px;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  .popup-frame img { width: 100%; display: block; }
  .popup-chrome {
    background: #dee1e6; padding: 6px 12px;
    display: flex; align-items: center; gap: 6px;
    font-family: -apple-system, sans-serif; font-size: 11px; color: #555;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-r { background: #ff5f57; }
  .dot-y { background: #ffbd2e; }
  .dot-g { background: #28c840; }
  .settings-label {
    position: absolute; bottom: 24px; right: 24px;
    background: rgba(99,102,241,0.9); color: white;
    padding: 8px 16px; border-radius: 8px;
    font-family: 'Nunito', -apple-system, sans-serif;
    font-size: 13px; font-weight: 700;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${Buffer.from(pageBuf).toString('base64')}">
  <div class="popup-frame">
    <div class="popup-chrome">
      <span class="dot dot-r"></span>
      <span class="dot dot-y"></span>
      <span class="dot dot-g"></span>
      <span style="margin-left:4px">PG Patrol — Settings</span>
    </div>
    <img src="data:image/png;base64,${Buffer.from(popupBuf).toString('base64')}">
  </div>
</body></html>`;

  await compositeScreenshots(
    extContext,
    html,
    SCREENSHOT_SIZE,
    path.join(OUTPUT_DIR, '05-settings-sensitivity.png'),
  );
}

// ── Screenshot 6: Invisible Protection ─────────

async function captureInvisibleProtection(
  extContext: BrowserContext,
  _extensionId: string,
): Promise<void> {
  console.log('  Screenshot 6: Invisible Protection');

  // ── Right side: extension-filtered social feed (looks natural) ──
  const afterPage = await extContext.newPage();
  await afterPage.setViewportSize({ width: 640, height: 800 });
  await afterPage.goto(`file://${path.join(DEMO_DIR, 'demo-profanity.html')}`);
  await sleep(3000);
  const afterBuf = await afterPage.screenshot({ type: 'png' });
  await afterPage.close();

  // ── Left side: mock blocker page via setContent ──
  const browser = await launchWithoutExtension();
  const beforePage = await browser.newPage();
  await beforePage.setViewportSize({ width: 640, height: 800 });

  const blockerHtml = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f0f2f5; color: #1c1e21;
  }
  .topbar {
    background: white; padding: 12px 24px; border-bottom: 1px solid #ddd;
    display: flex; align-items: center; justify-content: space-between;
  }
  .topbar-logo { font-size: 24px; font-weight: 800; color: #1877f2; }
  .topbar-search {
    background: #f0f2f5; border: none; border-radius: 20px;
    padding: 10px 20px; width: 240px; font-size: 14px; color: #999;
  }
  .topbar-icons { display: flex; gap: 16px; font-size: 20px; }

  .feed { max-width: 560px; margin: 16px auto; display: flex; flex-direction: column; gap: 14px; padding: 0 12px; }

  .post {
    background: white; border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow: hidden; position: relative;
  }
  .post-header {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px 6px;
  }
  .avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 14px;
  }
  .post-name { font-weight: 700; font-size: 14px; }
  .post-time { font-size: 11px; color: #65676b; }
  .post-body { padding: 4px 14px 12px; font-size: 14px; line-height: 1.5; color: #333; }

  /* Blocker overlays */
  .alert-bar {
    background: linear-gradient(90deg, #dc2626, #b91c1c);
    color: white; padding: 14px 18px;
    display: flex; align-items: center; gap: 12px;
    font-size: 13px; font-weight: 600;
    border-radius: 8px; margin: 0 12px 12px;
    box-shadow: 0 2px 8px rgba(220,38,38,0.3);
  }
  .alert-bar .stop-icon { font-size: 22px; }
  .alert-bar .verify-btn {
    margin-left: auto; background: white; color: #dc2626;
    border: none; padding: 6px 16px; border-radius: 4px;
    font-weight: 700; font-size: 12px; cursor: default; white-space: nowrap;
  }

  .image-blocked {
    background: #1a1a1a; margin: 0 14px 12px;
    border-radius: 10px; height: 160px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px;
    position: relative;
  }
  .image-blocked .warn-icon { font-size: 36px; opacity: 0.8; }
  .image-blocked .tag {
    color: #ccc; font-size: 14px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .image-blocked .link {
    color: #888; font-size: 11px; text-decoration: underline;
  }

  .toast {
    position: fixed; bottom: 20px; right: 16px;
    background: rgba(30,30,30,0.92); color: #ddd;
    padding: 12px 18px; border-radius: 10px;
    font-size: 12px; font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    display: flex; align-items: center; gap: 8px;
    backdrop-filter: blur(8px);
  }
  .toast .shield { font-size: 16px; }
</style></head>
<body>
  <div class="topbar">
    <span class="topbar-logo">Chatter</span>
    <input class="topbar-search" value="Search Chatter..." readonly>
    <div class="topbar-icons">&#x1F464; &#x1F514; &#x2630;</div>
  </div>

  <div class="feed">
    <!-- Alert bar -->
    <div class="alert-bar">
      <span class="stop-icon">&#x1F6D1;</span>
      <span>ACCESS RESTRICTED &mdash; This page contains inappropriate content. Age verification required.</span>
      <button class="verify-btn">Verify Age</button>
    </div>

    <!-- Post 1 with blocked image -->
    <div class="post">
      <div class="post-header">
        <div class="avatar">MJ</div>
        <div>
          <div class="post-name">Mike Johnson</div>
          <div class="post-time">2 hours ago</div>
        </div>
      </div>
      <div class="post-body">Had an absolutely wild time at the concert last night! The energy was unreal...</div>
      <div class="image-blocked">
        <span class="warn-icon">&#x26A0;&#xFE0F;</span>
        <span class="tag">Image Blocked</span>
        <span class="tag" style="font-size:12px; font-weight:600; text-transform:none; letter-spacing:0;">Adult content detected</span>
        <span class="link">Click to verify age</span>
      </div>
    </div>

    <!-- Post 2 -->
    <div class="post">
      <div class="post-header">
        <div class="avatar" style="background: linear-gradient(135deg, #f97316, #ec4899);">SL</div>
        <div>
          <div class="post-name">Sarah Lee</div>
          <div class="post-time">4 hours ago</div>
        </div>
      </div>
      <div class="post-body">This traffic is such a &#x2588;&#x2588;&#x2588;&#x2588;&#x2588;! I can't believe how &#x2588;&#x2588;&#x2588;&#x2588;&#x2588;&#x2588; slow this commute is. Every single day, the same &#x2588;&#x2588;&#x2588;&#x2588;...</div>
    </div>

    <!-- Post 3 with another blocked image -->
    <div class="post">
      <div class="post-header">
        <div class="avatar" style="background: linear-gradient(135deg, #10b981, #0ea5e9);">JD</div>
        <div>
          <div class="post-name">Jake Davis</div>
          <div class="post-time">6 hours ago</div>
        </div>
      </div>
      <div class="post-body">Check out this hilarious meme from last weekend...</div>
      <div class="image-blocked" style="height:120px;">
        <span class="warn-icon">&#x26A0;&#xFE0F;</span>
        <span class="tag">Image Blocked</span>
        <span class="link">Click to verify age</span>
      </div>
    </div>
  </div>

  <!-- Toast notification -->
  <div class="toast">
    <span class="shield">&#x1F6E1;&#xFE0F;</span>
    Content filter active &mdash; 5 items blocked on this page
  </div>
</body></html>`;

  await beforePage.setContent(blockerHtml, { waitUntil: 'networkidle' });
  await sleep(500);
  const beforeBuf = await beforePage.screenshot({ type: 'png' });
  await beforePage.close();
  await browser.close();

  // ── Composite: side-by-side with labels + bottom pill ──
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px; height: 800px;
    display: flex; position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f5f5f5;
  }

  .half { width: 640px; height: 800px; position: relative; overflow: hidden; }
  .half img { width: 100%; height: 100%; object-fit: cover; object-position: top; }

  .label {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 16px 24px;
    font-size: 18px; font-weight: 800; color: white;
    letter-spacing: 1.5px; text-transform: uppercase;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .label.before { background: linear-gradient(180deg, rgba(220,38,38,0.9) 0%, rgba(220,38,38,0.0) 100%); }
  .label.after { background: linear-gradient(180deg, rgba(34,197,94,0.9) 0%, rgba(34,197,94,0.0) 100%); }

  .divider {
    position: absolute; top: 0; bottom: 0; left: 639px;
    width: 2px; background: white; z-index: 10;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
  }

  /* Bottom callout badges */
  .callout {
    position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%);
    padding: 8px 20px; border-radius: 20px;
    font-size: 14px; font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  }
  .callout-left {
    left: 320px; /* center of left half */
    background: rgba(254,226,226,0.95); color: #991b1b;
    border: 1px solid rgba(220,38,38,0.3);
  }
  .callout-right {
    left: 960px; /* center of right half */
    background: rgba(220,252,231,0.95); color: #166534;
    border: 1px solid rgba(34,197,94,0.3);
  }

  /* Bottom center pill */
  .pill {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-radius: 20px; padding: 12px 32px;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    z-index: 20;
  }
  .pill-primary {
    font-size: 20px; font-weight: 900;
    background: linear-gradient(135deg, #4f46e5, #ec4899, #f97316);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pill-secondary {
    font-size: 13px; color: #6b7280; margin-top: 2px;
  }
</style></head>
<body>
  <!-- Left: Typical Content Filters -->
  <div class="half">
    <img src="data:image/png;base64,${Buffer.from(beforeBuf).toString('base64')}">
    <div class="label before">Typical Content Filters</div>
  </div>

  <div class="divider"></div>

  <!-- Right: PG Patrol -->
  <div class="half">
    <img src="data:image/png;base64,${Buffer.from(afterBuf).toString('base64')}">
    <div class="label after">PG Patrol</div>
  </div>

  <!-- Bottom callout badges -->
  <div class="callout callout-left">Kids see: "What's behind that?"</div>
  <div class="callout callout-right">Kids see: "Just a normal page"</div>

  <!-- Bottom center pill -->
  <div class="pill">
    <div class="pill-primary">Invisible Protection</div>
    <div class="pill-secondary">No blocks. No warnings. No curiosity triggers.</div>
  </div>
</body></html>`;

  await compositeScreenshots(
    extContext,
    html,
    SCREENSHOT_SIZE,
    path.join(OUTPUT_DIR, '06-invisible-protection.png'),
  );
}

// ── Promotional Tiles ──────────────────────────
// Use a separate non-extension browser so content scripts don't inject into the promo HTML

async function capturePromoTiles(): Promise<void> {
  const browser = await launchWithoutExtension();

  console.log('  Promo: Small tile (440x280)');
  const smallPage = await browser.newPage();
  await smallPage.setViewportSize({ width: 440, height: 280 });
  await smallPage.goto(`file://${path.join(STORE_ASSETS_DIR, 'promo-small.html')}`, {
    waitUntil: 'networkidle',
  });
  await sleep(1500); // Wait for font loading
  await smallPage.screenshot({
    path: path.join(OUTPUT_DIR, 'promo-small-440x280.png'),
    type: 'png',
  });
  await smallPage.close();

  console.log('  Promo: Marquee tile (1400x560)');
  const marqueePage = await browser.newPage();
  await marqueePage.setViewportSize({ width: 1400, height: 560 });
  await marqueePage.goto(`file://${path.join(STORE_ASSETS_DIR, 'promo-marquee.html')}`, {
    waitUntil: 'networkidle',
  });
  await sleep(1500); // Wait for font loading
  await marqueePage.screenshot({
    path: path.join(OUTPUT_DIR, 'promo-marquee-1400x560.png'),
    type: 'png',
  });
  await marqueePage.close();

  await browser.close();
}

// ── Main ───────────────────────────────────────

async function main() {
  console.log('PG Patrol — Store Screenshot Capture');
  console.log('====================================\n');

  // Verify dist/ exists
  if (!fs.existsSync(DIST_PATH)) {
    console.error('Error: dist/ not found. Run "npm run build:chrome" first.');
    process.exit(1);
  }

  // Ensure output dir exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Launching browser with extension...');
  const { context: extContext, extensionId } = await launchWithExtension();
  console.log(`Extension ID: ${extensionId}\n`);

  try {
    // Close default blank pages
    for (const p of extContext.pages()) {
      if (p.url() === 'about:blank') await p.close();
    }

    console.log('Capturing screenshots...\n');

    // Screenshot 1: Before vs After
    await captureBeforeAfter(extContext, extensionId);

    // Screenshot 2: Text Filtering + Popup
    await captureTextWithPopup(extContext, extensionId);

    // Screenshot 3: NSFW Image Blocking
    await captureImageBlocking(extContext, extensionId);

    // Screenshot 4: Good Vibes Mode
    await captureGoodVibes(extContext);

    // Screenshot 5: Settings & Sensitivity
    await captureSettings(extContext, extensionId);

    // Screenshot 6: Invisible Protection
    await captureInvisibleProtection(extContext, extensionId);

    // Promotional Tiles
    console.log('');
    console.log('Capturing promotional tiles...\n');
    await capturePromoTiles();
  } finally {
    await extContext.close();
  }

  // Report results
  console.log('\n====================================');
  console.log('All captures complete!\n');

  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const stats = fs.statSync(path.join(OUTPUT_DIR, file));
    const kb = Math.round(stats.size / 1024);
    console.log(`  ${file} (${kb} KB)`);
  }
  console.log(`\nOutput: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
