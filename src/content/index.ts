/**
 * PG Patrol Content Script — injected into every web page.
 * Scans and replaces profanity in text nodes, observes dynamic content,
 * and optionally scans images for NSFW content.
 */

import { getFilterableTextNodes } from './dom-walker';
import { startObserver, stopObserver, pauseObserver, resumeObserver } from './observer';
import { setCustomProfanity, setCustomSafeWords } from '../shared/profanity-engine';
import { getSettings, onSettingsChanged, isSiteWhitelisted } from '../shared/storage';
import { setCustomTriggers, setCustomSafeContext } from '../shared/negative-news-words';
import { loadRemoteWordList } from '../shared/word-list-updater';
import {
  queueImages,
  queueVideoElements,
  queueBackgroundImages,
  collectVideoThumbnails,
  collectBackgroundThumbnails,
  setSensitivity,
  setDeveloperMode,
  setCustomThreshold,
  getReplacedImageCount,
  onAllProcessed,
  onImageHidden,
  requeueImage,
  startViewportScanner,
  stopViewportScanner,
  observeImagesForViewport,
  ensureNsfwStyleSheet,
} from './image-scanner';
import { startShadowDomScanner, stopShadowDomScanner } from './shadow-dom-scanner';
import { isAdultDomain } from '../shared/adult-domain-keywords';
import { isSafeSearchSite } from '../shared/safe-search-sites';
import { loadModel } from '../shared/nsfw-detector';
import { getFilterableBlocks } from './block-scanner';
import { classifyToxicity } from '../shared/ml-text-classifier';
import { classifyWithChromeAi } from '../shared/chrome-ai';
import { applyOverlay, removeAllOverlays } from './block-overlay';
import { showImageFilterBanner, removeImageFilterBanner } from './image-filter-banner';
import { MessageType } from '../shared/types';
import {
  initFilterWorker,
  filterTextBatch,
  scoreTextBatch,
  syncCustomWords,
  applyWorkerWordListDelta,
  terminateWorker,
} from './filter-worker-proxy';
import type { PGPatrolSettings, Sensitivity, Message } from '../shared/types';

let settings: PGPatrolSettings | null = null;
let filteringPaused = false;
let isAdultSite = false;
let isSafeSite = false;

/**
 * Apply user custom words to all filtering engines.
 * Uses set* (not add*) so that removed words are actually cleared.
 * Also syncs to the Web Worker.
 */
function applyCustomWords(s: PGPatrolSettings): void {
  setCustomProfanity(s.customBlockedWords);
  setCustomSafeWords(s.customSafeWords);
  setCustomTriggers(s.customNegativeTriggers);
  setCustomSafeContext(s.customSafeContext);

  // Keep worker in sync
  syncCustomWords({
    customBlockedWords: s.customBlockedWords,
    customSafeWords: s.customSafeWords,
    customNegativeTriggers: s.customNegativeTriggers,
    customSafeContext: s.customSafeContext,
  });
}
let pageReplacementCount = 0;
let hiddenBlockCount = 0;

// Track processed nodes to avoid double-processing
let processedNodes = new WeakSet<Text>();

// Store original text content for reveal functionality
const originalTexts = new Map<Node, string>();

/**
 * Filter a set of text nodes using the profanity engine via the Web Worker.
 * Falls back to synchronous processing when worker is unavailable.
 */
async function filterTextNodes(nodes: Text[]): Promise<number> {
  let count = 0;
  const sensitivity: Sensitivity = settings?.sensitivity ?? 'moderate';

  // Collect nodes that need processing
  const nodesToProcess: Text[] = [];
  const textsToProcess: string[] = [];

  for (const node of nodes) {
    if (processedNodes.has(node)) continue;
    if (!node.textContent) continue;
    nodesToProcess.push(node);
    textsToProcess.push(node.textContent);
    processedNodes.add(node);
  }

  if (textsToProcess.length === 0) return 0;

  // Batch process through worker (or sync fallback)
  const results = await filterTextBatch(textsToProcess, sensitivity);

  // Apply results to DOM on main thread
  pauseObserver();

  for (let i = 0; i < nodesToProcess.length; i++) {
    const node = nodesToProcess[i];
    const result = results[i];

    if (result.hasProfanity) {
      // Store original before any modification
      if (!originalTexts.has(node)) {
        originalTexts.set(node, textsToProcess[i]);
      }

      if (result.profaneUrls.length > 0) {
        // Build a DocumentFragment with clickable [link] elements
        const fragment = document.createDocumentFragment();
        const parts = result.filtered.split('[link]');

        for (let j = 0; j < parts.length; j++) {
          if (parts[j]) {
            fragment.appendChild(document.createTextNode(parts[j]));
          }
          if (j < result.profaneUrls.length) {
            const a = document.createElement('a');
            a.href = result.profaneUrls[j].url;
            a.textContent = '[link]';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.dataset.pgPatrolLink = 'true';
            fragment.appendChild(a);
          }
        }

        // Replace the text node with the fragment
        const parent = node.parentNode;
        if (parent) {
          const childNodes = Array.from(fragment.childNodes);
          parent.replaceChild(fragment, node);
          for (const child of childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              processedNodes.add(child as Text);
            }
          }
        }
      } else {
        node.textContent = result.filtered;
      }

      count += result.replacements.length + result.profaneUrls.length;
    }
  }

  resumeObserver();
  return count;
}

/**
 * Reveal original text content, undoing all filtering.
 */
function revealOriginals(): void {
  pauseObserver();

  for (const [node, original] of originalTexts) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = original;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // For nodes that were replaced with fragments, handled via parent
      (node as Element).textContent = original;
    }
  }

  // Also restore nodes that were replaced with link fragments
  // Find all pg-patrol links and restore their parent's original text
  const links = document.querySelectorAll('a[data-pg-patrol-link]');
  for (const link of links) {
    const parent = link.parentNode;
    if (parent) {
      // Find original text for any child text node of this parent
      for (const [node, original] of originalTexts) {
        if (node.parentNode === parent || !node.parentNode) {
          // Create a fresh text node with the original content
          const textNode = document.createTextNode(original);
          // Remove all children and replace with original text
          while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
          }
          parent.appendChild(textNode);
          break;
        }
      }
    }
  }

  resumeObserver();
}

/**
 * Clear state and re-filter everything.
 */
async function refilterAll(): Promise<void> {
  revealOriginals();
  originalTexts.clear();
  processedNodes = new WeakSet<Text>();
  pageReplacementCount = 0;
  removeAllOverlays();
  removeImageFilterBanner();
  hiddenBlockCount = 0;
  await fullScan();
}

/**
 * Run a full DOM scan and filter all text nodes.
 */
async function fullScan(): Promise<void> {
  const textNodes = getFilterableTextNodes();
  const replaced = await filterTextNodes(textNodes);
  pageReplacementCount += replaced;
  await blockScan();
  updateBadge();
}

/**
 * Scan block-level elements for negative content (Good Vibes Mode).
 * Uses tiered scoring when ML classifier is enabled:
 *   Score > 0.06 → Block immediately (clear negative)
 *   Score 0.015–0.06 → ML classifier second opinion (borderline)
 *   Score < 0.015 → Allow immediately (clear safe)
 * Falls back to keyword-only scoring (threshold 0.03) when ML is disabled.
 * Scoring is batched through the Web Worker for off-main-thread processing.
 */
async function blockScan(root?: Node): Promise<void> {
  if (!settings?.positiveModeEnabled) return;

  const blocks = getFilterableBlocks(root);
  if (blocks.length === 0) return;

  // Batch score all block texts through the worker
  const texts = blocks.map((b) => b.text);
  const results = await scoreTextBatch(texts);

  for (let i = 0; i < blocks.length; i++) {
    const { element, text } = blocks[i];
    const result = results[i];

    if (settings?.mlClassifierEnabled) {
      // Tiered scoring with ML classifier
      if (result.score > 0.06) {
        // Tier 0: Clear negative — block immediately
        applyOverlay(element, { category: result.matches?.[0]?.category });
        hiddenBlockCount++;
      } else if (result.score > 0.015) {
        // Tier 1: Borderline — async ML classification
        classifyToxicity(text).then(async (mlResult) => {
          let shouldBlock = mlResult.isToxic;

          // Tier 2: Chrome AI refines borderline ML decisions (opportunistic)
          // Only invoked when ML confidence is low (0.3–0.7)
          if (mlResult.confidence > 0.3 && mlResult.confidence < 0.7) {
            const aiResult = await classifyWithChromeAi(text);
            if (aiResult !== null) {
              shouldBlock = aiResult.isToxic;
            }
          }

          if (shouldBlock) {
            applyOverlay(element, { category: result.matches?.[0]?.category });
            hiddenBlockCount++;
            updateBadge();
          }
        });
      }
      // Score ≤ 0.015: clear safe — allow immediately
    } else {
      // Original keyword-only scoring
      if (result.isNegative) {
        applyOverlay(element, { category: result.matches?.[0]?.category });
        hiddenBlockCount++;
      }
    }
  }
}

/**
 * Send replacement count to background for badge display.
 */
function updateBadge(): void {
  chrome.runtime.sendMessage({
    type: MessageType.UPDATE_STATS,
    data: {
      wordsReplaced: pageReplacementCount,
      imagesReplaced: getReplacedImageCount(),
    },
  }).catch(() => {
    // Background may not be ready
  });
}

/**
 * Handle messages from popup/background.
 */
function onMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  switch (message.type) {
    case MessageType.SETTINGS_CHANGED:
      if (message.data) {
        settings = { ...settings!, ...message.data };
        applyCustomWords(settings);
        if (settings.enabled && settings.textFilterEnabled) {
          refilterAll();
        }
        if (settings.imageFilterEnabled) {
          setSensitivity(settings.sensitivity);
          setDeveloperMode(settings.developerMode);
          setCustomThreshold(settings.customThreshold);
        }
      }
      break;
    case MessageType.TOGGLE_FILTERING:
      if (message.data.enabled) {
        filteringPaused = false;
        refilterAll();
        startObserverIfEnabled();
      } else {
        filteringPaused = true;
        stopObserver();
        stopViewportScanner();
        stopShadowDomScanner();
        revealOriginals();
        removeAllOverlays();
        terminateWorker();
      }
      break;
    case MessageType.GET_FILTER_STATE:
      sendResponse({ filteringPaused });
      break;
  }
}

/**
 * Image callback for the MutationObserver.
 */
function onNewImages(images: HTMLImageElement[]): void {
  if (settings?.imageFilterEnabled) {
    queueImages(images);
    observeImagesForViewport(images);
  }
}

/**
 * Video callback for the MutationObserver.
 */
function onNewVideos(videos: HTMLVideoElement[]): void {
  if (settings?.imageFilterEnabled) {
    queueVideoElements(videos);
  }
}

/**
 * Callback for when an image's src/srcset attribute changes (lazy-load detection).
 */
function onImageAttrChange(img: HTMLImageElement): void {
  if (settings?.imageFilterEnabled) {
    requeueImage(img);
  }
}

/**
 * Start mutation observer if filtering is enabled.
 */
function startObserverIfEnabled(): void {
  if (settings?.enabled) {
    startObserver(
      (textNodes) => {
        if (settings?.textFilterEnabled) {
          // Remove from processedNodes so SPA re-renders get re-evaluated
          for (const node of textNodes) {
            processedNodes.delete(node);
          }
          filterTextNodes(textNodes).then((replaced) => {
            if (replaced > 0) {
              pageReplacementCount += replaced;
              updateBadge();
            }
          });
        }
        // Also scan new subtrees for negative content
        if (settings?.positiveModeEnabled && textNodes.length > 0) {
          // Find common ancestors to scan as blocks
          const parents = new Set<Node>();
          for (const node of textNodes) {
            if (node.parentElement) parents.add(node.parentElement);
          }
          for (const parent of parents) {
            blockScan(parent);
          }
        }
      },
      settings.imageFilterEnabled && !isSafeSite ? onNewImages : undefined,
      settings.imageFilterEnabled && !isSafeSite ? onNewVideos : undefined,
      settings.imageFilterEnabled && !isSafeSite ? onImageAttrChange : undefined,
    );
  }
}

/**
 * Start image filtering if enabled.
 */
async function initImageFiltering(): Promise<void> {
  if (!settings?.imageFilterEnabled) {
    removePreBlurStylesheet();
    return;
  }

  // Safe-search sites: skip ML image scanning (no false positives, no overhead)
  if (isSafeSite) {
    removePreBlurStylesheet();
    return;
  }

  // Adult domains: keep all images permanently blurred, skip ML classification
  if (isAdultSite) {
    // Mark the pre-blur stylesheet so it's never removed
    const style = document.getElementById('pg-patrol-pre-blur');
    if (style) {
      style.dataset.adultDomain = 'true';
    }
    return;
  }

  setSensitivity(settings.sensitivity);
  setDeveloperMode(settings.developerMode);
  setCustomThreshold(settings.customThreshold);

  // Inject persistent scan-first stylesheet (blurs all unclassified images)
  // Must be active before any images are queued so nothing shows unblurred
  ensureNsfwStyleSheet();

  // Pre-load ONNX model before any queuing
  await loadModel();

  // Register callback to remove pre-blur only after all images are classified
  onAllProcessed(() => {
    removePreBlurStylesheet();
  });

  // Show/update banner each time an image is hidden
  onImageHidden((count) => {
    showImageFilterBanner(count);
    updateBadge();
  });

  // Scan existing images on the page
  const images = Array.from(document.querySelectorAll('img'));
  queueImages(images);

  // Scan video poster thumbnails
  const videos = collectVideoThumbnails();
  queueVideoElements(videos);

  // Scan background-image thumbnails (video players, custom thumbnails)
  const bgElements = collectBackgroundThumbnails();
  queueBackgroundImages(bgElements);

  // If nothing was queued, remove pre-blur immediately
  if (images.length === 0 && videos.length === 0 && bgElements.length === 0) {
    removePreBlurStylesheet();
  }

  // Safety timeout: don't leave page blurred forever if classification stalls
  setTimeout(() => {
    if (document.getElementById('pg-patrol-pre-blur') && !isAdultSite) {
      removePreBlurStylesheet();
    }
  }, 15000);

  // Start viewport scanner (IntersectionObserver) to catch images from
  // infinite scroll, container-level scrolling, and retry pending images
  startViewportScanner();

  // Start shadow DOM scanner to detect and scan images inside shadow roots
  startShadowDomScanner();
}

/**
 * Remove the pre-blur CSS stylesheet injected by pre-blur.ts.
 */
function removePreBlurStylesheet(): void {
  if (isAdultSite) return; // Never remove on adult domains
  document.getElementById('pg-patrol-pre-blur')?.remove();
}

/**
 * Remove the body { visibility: hidden } rule added by pre-blur.ts
 * while keeping the image/video blur rules intact.
 */
function revealBody(): void {
  const style = document.getElementById('pg-patrol-pre-blur');
  if (style) {
    style.textContent = (style.textContent || '').replace(/body\s*\{[^}]*visibility:\s*hidden[^}]*\}/g, '');
  }
}

/**
 * Initialize the content script.
 */
async function init(): Promise<void> {
  // Initialize the Web Worker for off-main-thread text processing
  initFilterWorker();

  try {
    settings = await getSettings();
  } catch {
    // Storage might not be available; use defaults
    settings = {
      enabled: true,
      textFilterEnabled: true,
      imageFilterEnabled: true,
      positiveModeEnabled: true,
      mlClassifierEnabled: true,
      sensitivity: 'strict',
      developerMode: false,
      customThreshold: 0.10,
      whitelistedSites: [],
      perspectiveApiKey: '',
      customBlockedWords: [],
      customSafeWords: [],
      customNegativeTriggers: [],
      customSafeContext: [],
      stats: { totalWordsReplaced: 0, totalImagesReplaced: 0 },
    };
  }

  // Layer 2: Apply cached remote word list delta (if available)
  const wordDelta = await loadRemoteWordList();

  // Sync word list delta to worker
  if (wordDelta) {
    applyWorkerWordListDelta(wordDelta);
  }

  // Layer 3: Apply user custom words (highest priority)
  applyCustomWords(settings);

  // Check if this is a known adult domain
  const hostname = window.location.hostname;
  isAdultSite = isAdultDomain(hostname);
  isSafeSite = isSafeSearchSite(hostname);

  // Check if site is whitelisted
  try {
    if (await isSiteWhitelisted(hostname)) {
      removePreBlurStylesheet();
      return;
    }
  } catch {
    // Continue with filtering if check fails
  }

  if (!settings.enabled) {
    removePreBlurStylesheet();
    return;
  }

  // Text filtering
  if (settings.textFilterEnabled) {
    await fullScan();
  }

  // Reveal body now that text scan is done (pre-blur hid it at document_start).
  // Must run even if text filtering is disabled so the page becomes visible.
  revealBody();

  // Image filtering (async, lazy model load)
  initImageFiltering();

  // Start observing for dynamic content
  startObserverIfEnabled();

  // Delayed re-scans to catch SPA content injected after document_idle
  if (settings.textFilterEnabled) {
    setTimeout(() => fullScan(), 1500);
    setTimeout(() => fullScan(), 3500);
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener(onMessage);

  // Listen for settings changes
  onSettingsChanged((newSettings) => {
    const prevImageEnabled = settings?.imageFilterEnabled;
    settings = newSettings;

    // Re-apply custom words when settings change
    applyCustomWords(settings);

    if (settings.enabled && settings.textFilterEnabled) {
      refilterAll();
    }

    // If image filtering was just enabled, do an initial scan
    if (settings.imageFilterEnabled && !prevImageEnabled && !isSafeSite) {
      initImageFiltering();
    }

    // Sync developer mode and custom threshold
    setDeveloperMode(settings.developerMode);
    setCustomThreshold(settings.customThreshold);

    startObserverIfEnabled();

    if (!settings.enabled) {
      stopObserver();
      stopViewportScanner();
      stopShadowDomScanner();
      terminateWorker();
    }
  });
}

init();
