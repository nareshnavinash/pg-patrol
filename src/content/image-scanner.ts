/**
 * Image & video thumbnail scanner — detects and replaces NSFW images on the page.
 * Scans <img> elements, <video poster> thumbnails, and CSS background-image
 * elements that are likely video thumbnails.
 */

import { classifyImage, classifyImageUrl, isModelReady, loadModel } from '../shared/nsfw-detector';
import type { Sensitivity } from '../shared/types';
import { imageCache } from '../shared/image-classification-cache';
import {
  isOverlayOwnedImage,
  removeAllMediaSurfaces,
  removeMediaSurface,
  showBlockedSurface,
  showErrorSurface,
  showPendingSurface,
  showSafeBackgroundSurface,
} from './media-surfaces';
import { pauseObserver, resumeObserver } from './observer';
import { createBannerDataUri } from './banner-data-uri';

const PROCESSED_ATTR = 'data-pg-patrol-img-processed';
const VIDEO_PROCESSED_ATTR = 'data-pg-patrol-vid-processed';
const BG_PROCESSED_ATTR = 'data-pg-patrol-bg-processed';
const DEBUG_BADGE_ATTR = 'data-pg-patrol-debug-badge';
const SOURCE_ATTR = 'data-pg-patrol-img-source';
const MASKED_ATTR = 'data-pg-patrol-img-masked';
const REPLACED_ATTR = 'data-pg-patrol-replaced';
const ORIGINAL_SRC_ATTR = 'data-pg-patrol-original-src';
const OVERLAY_OWNED_ATTR = 'data-pg-patrol-overlay-owned';
const PENDING_RETRY_ATTR = 'data-pg-patrol-pending-retry';
const MIN_IMAGE_SIZE = 50; // Skip images smaller than 50px
const MAX_CONCURRENT = 6; // Max concurrent classifications
const LOAD_TIMEOUT_MS = 10_000; // Max time to wait for an image to load
const FINAL_STATUSES = new Set(['safe', 'nsfw', 'error', 'skipped']);
const RAW_BG_IMAGE_ATTR = 'data-pg-patrol-bg-original-image';
const RAW_BG_COLOR_ATTR = 'data-pg-patrol-bg-original-color';

const MAX_QUEUE_SIZE = 200;

let activeScanCount = 0;
const scanQueue: HTMLImageElement[] = [];
const videoQueue: HTMLVideoElement[] = [];
const bgQueue: HTMLElement[] = [];
const queuedImages = new WeakSet<HTMLImageElement>();
const processingImages = new WeakSet<HTMLImageElement>();
let sensitivity: Sensitivity = 'moderate';
let replacedCount = 0;
let developerMode = false;
let customThreshold: number | null = null;
const imageScanVersions = new WeakMap<HTMLImageElement, number>();

// Per-page URL set: prevents double-counting replacedCount on React re-renders.
// Separate from the persistent ImageClassificationCache which handles classification fast-path.
const pageNsfwUrls = new Set<string>();

/**
 * Initialize the persistent image classification cache.
 * Must be called before any image scanning begins.
 */
export async function initImageCache(): Promise<void> {
  await imageCache.init();
}

/**
 * Expose the cache instance for threshold updates from index.ts.
 */
export { imageCache };

// Persistent stylesheet for scan-first blur and final NSFW hiding.
// CSS rules survive React/framework re-renders.
let nsfwStyleEl: HTMLStyleElement | null = null;

/**
 * Inject a persistent CSS stylesheet that keeps raw media hidden while
 * extension-owned surfaces control what is visible to the user.
 */
export function ensureNsfwStyleSheet(): void {
  if (nsfwStyleEl?.parentNode) return;
  nsfwStyleEl = document.createElement('style');
  nsfwStyleEl.id = 'pg-patrol-nsfw-styles';
  nsfwStyleEl.textContent =
    `img:not([data-pg-patrol-overlay-owned="true"]):not([${REPLACED_ATTR}="true"]):not([${PROCESSED_ATTR}="safe"]):not([${PROCESSED_ATTR}="skipped"]){` +
    `opacity:0!important;visibility:hidden!important;pointer-events:none!important;user-select:none!important;}` +
    `video:not([${VIDEO_PROCESSED_ATTR}="safe"]):not([${VIDEO_PROCESSED_ATTR}="skipped"]){` +
    `opacity:0!important;visibility:hidden!important;pointer-events:none!important;user-select:none!important;}`;
  (document.head || document.documentElement).appendChild(nsfwStyleEl);
}

/** Returns the CSS text used by the scan-first stylesheet (for Shadow DOM injection). */
export function getNsfwStyleSheetCssText(): string {
  return (
    `img:not([data-pg-patrol-overlay-owned="true"]):not([${REPLACED_ATTR}="true"]):not([${PROCESSED_ATTR}="safe"]):not([${PROCESSED_ATTR}="skipped"]){` +
    `opacity:0!important;visibility:hidden!important;pointer-events:none!important;user-select:none!important;}` +
    `video:not([${VIDEO_PROCESSED_ATTR}="safe"]):not([${VIDEO_PROCESSED_ATTR}="skipped"]){` +
    `opacity:0!important;visibility:hidden!important;pointer-events:none!important;user-select:none!important;}`
  );
}

// Completion tracking for pre-blur removal
let totalQueued = 0;
let totalProcessed = 0;
let onAllProcessedCallback: (() => void) | null = null;
let onImageHiddenCallback: ((count: number) => void) | null = null;
let onScanProgressCallback: ((processed: number, total: number) => void) | null = null;

/**
 * Register a callback to be invoked when all queued items have been processed.
 * Used by the content script to remove the pre-blur stylesheet at the right time.
 */
export function onAllProcessed(callback: () => void): void {
  onAllProcessedCallback = callback;
}

/**
 * Register a callback invoked each time an image/video/bg is hidden as NSFW.
 * Receives the running total of replaced images.
 */
export function onImageHidden(callback: (count: number) => void): void {
  onImageHiddenCallback = callback;
}

/**
 * Register a callback invoked each time a queued item finishes processing.
 * Receives the number of processed items and total queued items.
 */
export function onScanProgress(callback: (processed: number, total: number) => void): void {
  onScanProgressCallback = callback;
}

function checkAllProcessed(): void {
  onScanProgressCallback?.(totalProcessed, totalQueued);

  if (
    totalProcessed >= totalQueued &&
    totalQueued > 0 &&
    scanQueue.length === 0 &&
    videoQueue.length === 0 &&
    bgQueue.length === 0 &&
    activeScanCount === 0
  ) {
    onAllProcessedCallback?.();
    onAllProcessedCallback = null;
  }
}

/**
 * Set the sensitivity level for image scanning.
 */
export function setSensitivity(s: Sensitivity): void {
  sensitivity = s;
}

/**
 * Set developer mode on/off.
 */
export function setDeveloperMode(enabled: boolean): void {
  developerMode = enabled;
}

/**
 * Set custom threshold override (null = use sensitivity preset).
 */
export function setCustomThreshold(threshold: number | null): void {
  customThreshold = threshold;
}

/**
 * Get the number of replaced images on the current page.
 */
export function getReplacedImageCount(): number {
  return replacedCount;
}

// ---- Developer mode helpers ----

/**
 * Show a score overlay badge on an image (developer mode only).
 * Uses absolute positioning inside the image's parent container.
 * Deduplicates: only one badge per image element.
 */
function showScoreOverlay(target: HTMLElement, score: number, verdict: string): void {
  // Dedup: don't add a second badge to the same element
  if (target.getAttribute(DEBUG_BADGE_ATTR)) return;
  target.setAttribute(DEBUG_BADGE_ATTR, 'true');

  const parent = target.parentElement;
  if (!parent) return;

  const color = verdict === 'nsfw' ? '#ef4444' : verdict === 'safe' ? '#22c55e' : '#eab308';

  const badge = document.createElement('span');
  badge.className = 'pg-patrol-score-badge';
  badge.textContent = `${score.toFixed(2)} (${verdict})`;

  // Ensure parent is a positioning context
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  Object.assign(badge.style, {
    position: 'absolute',
    top: `${target.offsetTop + 4}px`,
    left: `${target.offsetLeft + 4}px`,
    zIndex: '99999',
    background: color,
    color: 'white',
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  });

  parent.appendChild(badge);
}

/**
 * Apply a color-coded debug border to an image (developer mode only).
 */
function applyDebugBorder(el: HTMLElement, verdict: string): void {
  switch (verdict) {
    case 'safe':
      el.style.outline = '2px solid #22c55e';
      break;
    case 'nsfw':
      el.style.outline = '2px solid #ef4444';
      break;
    case 'skipped':
      el.style.outline = '2px solid #eab308';
      break;
    case 'error':
      el.style.outline = '2px dashed #9ca3af';
      break;
  }
}

/**
 * Log a scan decision to the console (developer mode only).
 */
function logDecision(src: string, score: number | null, verdict: string): void {
  const thresholdStr = customThreshold != null ? customThreshold : `preset(${sensitivity})`;
  if (score !== null) {
    console.log(
      `[PG Patrol] IMG: ${src} → score=${score.toFixed(3)}, threshold=${thresholdStr}, verdict=${verdict.toUpperCase()}`,
    );
  } else {
    console.log(`[PG Patrol] IMG: ${src} → ${verdict.toUpperCase()}`);
  }
}

// ---- Lazy-load handling ----

/**
 * Get a real scannable URL from an image, handling lazy-load patterns.
 * Prefers currentSrc (browser-resolved from srcset), then src, then srcset first entry.
 * Filters out placeholder/blank images.
 */
function getScannableSrc(img: HTMLImageElement): string | null {
  // currentSrc is the browser's resolved URL (accounts for srcset + media queries)
  if (img.currentSrc && !isPlaceholderUrl(img.currentSrc)) {
    return img.currentSrc;
  }
  // Fall back to src if it's a real URL
  if (img.src && !isPlaceholderUrl(img.src)) {
    return img.src;
  }
  // Fall back to srcset first entry
  if (img.srcset) {
    const firstSrc = img.srcset.split(',')[0]?.trim().split(' ')[0];
    if (firstSrc && !isPlaceholderUrl(firstSrc)) return firstSrc;
  }
  return null;
}

/**
 * Check if a URL is a placeholder/blank image that shouldn't be scanned.
 */
function isPlaceholderUrl(url: string): boolean {
  if (!url) return true;
  if (url.endsWith('blank.gif') || url.endsWith('placeholder.gif') || url.endsWith('spacer.gif'))
    return true;
  if (url.startsWith('data:') && url.length < 1000) return true;
  if (url.startsWith('data:image/gif;base64,R0lGOD')) return true; // 1x1 transparent GIF
  return false;
}

// ---- Image scanning ----

function getPermanentSkipReason(img: HTMLImageElement): string | null {
  const w = img.complete ? img.naturalWidth : img.width || img.naturalWidth;
  const h = img.complete ? img.naturalHeight : img.height || img.naturalHeight;
  if (w > 0 && w < MIN_IMAGE_SIZE && h > 0 && h < MIN_IMAGE_SIZE) {
    return 'small image';
  }

  const rawSrc = img.currentSrc || img.src || img.srcset.split(',')[0]?.trim().split(' ')[0] || '';
  if (rawSrc.endsWith('.svg') || rawSrc.startsWith('data:image/svg')) {
    return 'svg image';
  }

  const src = getScannableSrc(img);
  if (!src) return null;

  return null;
}

function hasFinalStatus(img: HTMLImageElement): boolean {
  const status = img.getAttribute(PROCESSED_ATTR);
  return status ? FINAL_STATUSES.has(status) : false;
}

function rememberImageSource(img: HTMLImageElement, src: string | null): void {
  if (src) {
    img.setAttribute(SOURCE_ATTR, src);
  } else {
    img.removeAttribute(SOURCE_ATTR);
  }
}

function clearDebugState(img: HTMLImageElement): void {
  img.removeAttribute(DEBUG_BADGE_ATTR);
  img.style.outline = '';
}

function getImageScanVersion(img: HTMLImageElement): number {
  return imageScanVersions.get(img) || 0;
}

function bumpImageScanVersion(img: HTMLImageElement): number {
  const nextVersion = getImageScanVersion(img) + 1;
  imageScanVersions.set(img, nextVersion);
  return nextVersion;
}

function rememberBgStyle(element: HTMLElement): void {
  if (!element.hasAttribute(RAW_BG_IMAGE_ATTR)) {
    element.setAttribute(RAW_BG_IMAGE_ATTR, element.style.backgroundImage || '');
  }
  if (!element.hasAttribute(RAW_BG_COLOR_ATTR)) {
    element.setAttribute(RAW_BG_COLOR_ATTR, element.style.backgroundColor || '');
  }
}

function hideRawBackground(element: HTMLElement): void {
  rememberBgStyle(element);
  element.style.setProperty('background-image', 'none', 'important');
  element.style.setProperty('background-color', 'transparent', 'important');
}

function restoreRawBackground(element: HTMLElement): void {
  const originalImage = element.getAttribute(RAW_BG_IMAGE_ATTR);
  const originalColor = element.getAttribute(RAW_BG_COLOR_ATTR);

  if (originalImage !== null) {
    if (originalImage) {
      element.style.backgroundImage = originalImage;
    } else {
      element.style.removeProperty('background-image');
    }
    element.removeAttribute(RAW_BG_IMAGE_ATTR);
  } else {
    element.style.removeProperty('background-image');
  }

  if (originalColor !== null) {
    if (originalColor) {
      element.style.backgroundColor = originalColor;
    } else {
      element.style.removeProperty('background-color');
    }
    element.removeAttribute(RAW_BG_COLOR_ATTR);
  } else {
    element.style.removeProperty('background-color');
  }
}

function revealSafeImage(img: HTMLImageElement): void {
  removeMediaSurface(img);
  clearImageMaskStyles(img);
  removeBlur(img);
}

function restoreExistingImageSurface(img: HTMLImageElement): void {
  const status = img.getAttribute(PROCESSED_ATTR);
  if (!status) {
    return;
  }

  if (status === 'pending') {
    showPendingSurface(img);
    return;
  }

  if (status === 'safe') {
    revealSafeImage(img);
    return;
  }

  if (status === 'nsfw') {
    // Banner IS the image — no overlay needed
    if (img.getAttribute(REPLACED_ATTR) === 'true') return;
    showBlockedSurface(img);
    return;
  }

  if (status === 'error') {
    showErrorSurface(img);
  }
}

function markImageSkipped(img: HTMLImageElement, reason: string): void {
  removeMediaSurface(img);
  clearImageMaskStyles(img);
  removeBlur(img);
  img.setAttribute(PROCESSED_ATTR, 'skipped');
  img.removeAttribute(MASKED_ATTR);
  if (developerMode) {
    applyDebugBorder(img, 'skipped');
    logDecision(getScannableSrc(img) || img.src || '(no src)', null, `skipped (${reason})`);
  }
}

function markImagePending(img: HTMLImageElement, reason: string): void {
  applyImageMaskStyles(img);
  img.setAttribute(PROCESSED_ATTR, 'pending');
  img.removeAttribute(MASKED_ATTR);
  showPendingSurface(img);
  observeImagesForViewport([img]);
  if (developerMode) {
    logDecision(getScannableSrc(img) || img.src || '(no src)', null, `pending (${reason})`);
  }
}

function queuePendingRetryOnLoad(img: HTMLImageElement): void {
  if (img.getAttribute(PENDING_RETRY_ATTR) === 'true') return;

  img.setAttribute(PENDING_RETRY_ATTR, 'true');
  img.addEventListener(
    'load',
    () => {
      img.removeAttribute(PENDING_RETRY_ATTR);
      requeueImage(img);
    },
    { once: true },
  );
}

function shouldQueueImage(img: HTMLImageElement): boolean {
  if (isOverlayOwnedImage(img)) return false;
  if (hasFinalStatus(img)) return false;
  if (queuedImages.has(img) || processingImages.has(img)) return false;
  if (getPermanentSkipReason(img)) return false;
  return getScannableSrc(img) !== null;
}

/**
 * Remove blur from a safe element.
 */
function removeBlur(el: HTMLElement): void {
  el.style.removeProperty('filter');
}

function applyImageMaskStyles(img: HTMLImageElement): void {
  img.style.setProperty('opacity', '0', 'important');
  img.style.setProperty('visibility', 'hidden', 'important');
  img.style.setProperty('pointer-events', 'none', 'important');
  img.style.setProperty('user-select', 'none', 'important');
}

function clearImageMaskStyles(img: HTMLImageElement): void {
  img.style.removeProperty('opacity');
  img.style.removeProperty('visibility');
  img.style.removeProperty('pointer-events');
  img.style.removeProperty('user-select');
}

/**
 * Hide an NSFW image and mount a banner overlay in the same visual slot.
 * The original source is preserved in data attributes. Count is deduplicated
 * by URL to prevent inflation from re-renders.
 */
function hideImage(img: HTMLImageElement): void {
  const source = img.getAttribute(SOURCE_ATTR) || getScannableSrc(img) || img.src;

  // Dedup: only count each unique URL once per page navigation
  if (source && !pageNsfwUrls.has(source)) {
    pageNsfwUrls.add(source);
    replacedCount++;
    onImageHiddenCallback?.(replacedCount);
    try {
      chrome.runtime
        .sendMessage({
          type: 'LOG_ACTIVITY',
          data: {
            type: 'image',
            original: source.length > 100 ? source.slice(0, 97) + '...' : source,
            timestamp: Date.now(),
          },
        })
        .catch(() => {});
    } catch {
      // chrome.runtime may be unavailable in tests
    }
  }

  pauseObserver();

  const banner = document.createElement('img');
  banner.src = createBannerDataUri();
  banner.alt = 'Restricted image hidden by PG Patrol';

  // Mark as ours — exempt from scanning + CSS hiding
  banner.setAttribute(OVERLAY_OWNED_ATTR, 'true');
  banner.setAttribute(PROCESSED_ATTR, 'nsfw');
  banner.setAttribute(REPLACED_ATTR, 'true');
  banner.setAttribute(SOURCE_ATTR, source);
  banner.setAttribute(ORIGINAL_SRC_ATTR, img.src || '');

  // Copy layout attributes to preserve page structure
  if (img.className) banner.className = img.className;
  if (img.id) banner.id = img.id;
  if (img.width) banner.width = img.width;
  if (img.height) banner.height = img.height;
  banner.style.cssText = img.style.cssText;
  banner.style.objectFit = 'contain';
  banner.style.backgroundColor = '#EEF2FF';
  // Force visible (override NSFW stylesheet)
  banner.style.setProperty('opacity', '1', 'important');
  banner.style.setProperty('visibility', 'visible', 'important');

  img.replaceWith(banner);

  resumeObserver();
}

/**
 * Process a single image: classify and handle result.
 */
async function processImage(img: HTMLImageElement): Promise<void> {
  if (isOverlayOwnedImage(img) || hasFinalStatus(img)) {
    return;
  }

  const scanVersion = getImageScanVersion(img);
  const permanentSkipReason = getPermanentSkipReason(img);
  if (permanentSkipReason) {
    markImageSkipped(img, permanentSkipReason);
    rememberImageSource(img, getScannableSrc(img));
    return;
  }

  const attemptSrc = getScannableSrc(img);
  if (!attemptSrc) {
    markImagePending(img, 'waiting for real src');
    queuePendingRetryOnLoad(img);
    return;
  }

  rememberImageSource(img, attemptSrc);

  // Fast path: persistent cache hit (both safe and NSFW)
  const cached = imageCache.get(attemptSrc);
  if (cached) {
    if (cached.verdict === 'nsfw') {
      hideImage(img);
      if (developerMode) {
        logDecision(attemptSrc, cached.score, 'nsfw (cached)');
      }
    } else {
      // Safe — show image without running model
      img.setAttribute(PROCESSED_ATTR, 'safe');
      img.removeAttribute(MASKED_ATTR);
      revealSafeImage(img);
      if (developerMode) {
        showScoreOverlay(img, cached.score, 'safe');
        applyDebugBorder(img, 'safe');
        logDecision(attemptSrc, cached.score, 'safe (cached)');
      }
    }
    rememberImageSource(img, attemptSrc);
    return;
  }

  try {
    // Wait for image to load (with timeout to prevent queue starvation)
    if (!img.complete) {
      const loadResult = await Promise.race([
        new Promise<'loaded' | 'error'>((resolve) => {
          img.addEventListener('load', () => resolve('loaded'), { once: true });
          img.addEventListener('error', () => resolve('error'), { once: true });
        }),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), LOAD_TIMEOUT_MS)),
      ]);

      if (loadResult === 'timeout') {
        markImagePending(img, 'load timeout');
        queuePendingRetryOnLoad(img);
        return;
      }
      if (loadResult === 'error') {
        throw new Error('Image load failed');
      }
    }

    // Ensure pixels are fully decoded for reliable classification
    try {
      await img.decode();
    } catch {
      img.setAttribute(PROCESSED_ATTR, 'error');
      img.setAttribute(MASKED_ATTR, 'true');
      applyImageMaskStyles(img);
      showErrorSurface(img);
      rememberImageSource(img, attemptSrc);
      return;
    }

    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      markImagePending(img, 'zero natural size');
      queuePendingRetryOnLoad(img);
      return;
    }

    const scannableSrc = getScannableSrc(img);
    if (!scannableSrc) {
      markImagePending(img, 'src disappeared after load');
      queuePendingRetryOnLoad(img);
      return;
    }

    if (scannableSrc !== attemptSrc) {
      markImagePending(img, 'src changed during load');
      queueMicrotask(() => requeueImage(img));
      return;
    }

    const result = await classifyImage(img, sensitivity, customThreshold);

    const finalSrc = getScannableSrc(img);
    if (getImageScanVersion(img) !== scanVersion || !finalSrc || finalSrc !== attemptSrc) {
      markImagePending(img, 'src changed during classification');
      queueMicrotask(() => requeueImage(img));
      return;
    }

    // Store in persistent cache
    const imgSize = Math.max(img.clientWidth || 0, img.clientHeight || 0);
    const imgContext = imageCache.detectContext(finalSrc, img);
    const verdict = result.isNSFW ? ('nsfw' as const) : ('safe' as const);
    imageCache.set(finalSrc, verdict, result.score, imgSize, imgContext);

    if (result.isNSFW) {
      hideImage(img);
      if (developerMode) {
        logDecision(finalSrc, result.score, 'nsfw');
      }
    } else {
      img.setAttribute(PROCESSED_ATTR, 'safe');
      img.removeAttribute(MASKED_ATTR);
      revealSafeImage(img);
      if (developerMode) {
        showScoreOverlay(img, result.score, 'safe');
        applyDebugBorder(img, 'safe');
        logDecision(finalSrc, result.score, 'safe');
      }
    }
    rememberImageSource(img, finalSrc);
  } catch {
    // Fail-safe: keep the raw image hidden behind an error cover.
    img.setAttribute(PROCESSED_ATTR, 'error');
    img.setAttribute(MASKED_ATTR, 'true');
    applyImageMaskStyles(img);
    showErrorSurface(img);
    rememberImageSource(img, attemptSrc);
    if (developerMode) {
      applyDebugBorder(img, 'error');
      logDecision(img.src || '(unknown)', null, 'error (fail-safe cover)');
    }
  }
}

// ---- Shared NSFW handling helpers ----

function handleNsfwVideo(video: HTMLVideoElement): void {
  video.setAttribute(VIDEO_PROCESSED_ATTR, 'nsfw');
  ensureNsfwStyleSheet();
  showBlockedSurface(video);
  if (video.poster && !pageNsfwUrls.has(video.poster)) {
    pageNsfwUrls.add(video.poster);
    replacedCount++;
    onImageHiddenCallback?.(replacedCount);
  }
}

function handleNsfwBg(element: HTMLElement, url: string): void {
  element.setAttribute(BG_PROCESSED_ATTR, 'nsfw');
  hideRawBackground(element);
  showBlockedSurface(element);
  if (!pageNsfwUrls.has(url)) {
    pageNsfwUrls.add(url);
    replacedCount++;
    onImageHiddenCallback?.(replacedCount);
  }
}

function handleSafeBg(element: HTMLElement, url: string): void {
  hideRawBackground(element);
  element.setAttribute(BG_PROCESSED_ATTR, 'safe');
  const computed = getComputedStyle(element);
  showSafeBackgroundSurface(element, {
    imageUrl: url,
    backgroundSize: computed.backgroundSize || 'cover',
    backgroundPosition: computed.backgroundPosition || 'center center',
    backgroundRepeat: computed.backgroundRepeat || 'no-repeat',
    backgroundColor: computed.backgroundColor || 'transparent',
  });
}

// ---- Video poster scanning ----

/**
 * Check if a video element should be scanned for its poster thumbnail.
 */
export function shouldScanVideo(video: HTMLVideoElement): boolean {
  if (video.getAttribute(VIDEO_PROCESSED_ATTR)) return false;
  if (!video.poster) return false;
  if (video.poster.endsWith('.svg') || video.poster.startsWith('data:image/svg')) return false;
  return true;
}

/**
 * Process a single video element: classify its poster and handle result.
 * Hides the video and inserts a banner if NSFW.
 */
async function processVideoElement(video: HTMLVideoElement): Promise<void> {
  if (!shouldScanVideo(video)) {
    removeMediaSurface(video);
    video.setAttribute(VIDEO_PROCESSED_ATTR, 'skipped');
    return;
  }

  // Fast path: persistent cache hit
  const cached = imageCache.get(video.poster);
  if (cached) {
    if (cached.verdict === 'nsfw') {
      handleNsfwVideo(video);
    } else {
      removeMediaSurface(video);
      video.setAttribute(VIDEO_PROCESSED_ATTR, 'safe');
    }
    return;
  }

  try {
    const result = await classifyImageUrl(video.poster, sensitivity, customThreshold);

    // Store in persistent cache — use video dimensions for size
    const vidSize = Math.max(video.clientWidth || 0, video.clientHeight || 0);
    const vidContext = imageCache.detectContext(video.poster, video as unknown as HTMLElement);
    const verdict = result.isNSFW ? ('nsfw' as const) : ('safe' as const);
    imageCache.set(video.poster, verdict, result.score, vidSize, vidContext);

    if (result.isNSFW) {
      handleNsfwVideo(video);
    } else {
      removeMediaSurface(video);
      video.setAttribute(VIDEO_PROCESSED_ATTR, 'safe');
    }
  } catch {
    showErrorSurface(video);
    video.setAttribute(VIDEO_PROCESSED_ATTR, 'error');
  }
}

// ---- CSS background-image scanning ----

/**
 * Extract the URL from a CSS background-image value.
 * Returns null if no valid URL is found.
 */
export function extractBgImageUrl(bgValue: string): string | null {
  if (!bgValue || bgValue === 'none') return null;
  const match = bgValue.match(/url\(["']?([^"')]+)["']?\)/);
  return match ? match[1] : null;
}

/**
 * Get the background-image URL from an element, checking inline style
 * first, then falling back to computed style.
 */
function getElementBgImageUrl(element: HTMLElement): string | null {
  const inlineBg = element.style.backgroundImage || '';
  const inlineUrl = extractBgImageUrl(inlineBg);
  if (inlineUrl) return inlineUrl;

  const computedBg = getComputedStyle(element).backgroundImage || '';
  return extractBgImageUrl(computedBg);
}

/**
 * Check if an element's background-image should be scanned for NSFW content.
 * Scans any element with a meaningful image URL and minimum rendered size.
 */
export function shouldScanBgImage(element: HTMLElement): boolean {
  if (element.getAttribute('data-pg-patrol-overlay-owned') === 'true') return false;
  if (element.getAttribute(BG_PROCESSED_ATTR)) return false;

  const url = getElementBgImageUrl(element);
  if (!url) return false;

  // Skip SVGs and small data URIs
  if (url.endsWith('.svg') || url.startsWith('data:image/svg')) return false;
  if (url.startsWith('data:') && url.length < 1000) return false;

  // Skip elements too small to contain meaningful imagery
  const rect = element.getBoundingClientRect();
  if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) return false;

  return true;
}

/** @deprecated Use shouldScanBgImage instead */
export const isVideoThumbnailBg = shouldScanBgImage;

/**
 * Process an element with a background-image: classify and handle result.
 * Clears the background-image and inserts a banner if NSFW.
 */
async function processBackgroundImage(element: HTMLElement): Promise<void> {
  if (element.getAttribute(BG_PROCESSED_ATTR)) return;

  // Try live inline/computed style first; fall back to the saved original
  // (queueBackgroundImages calls hideRawBackground before queue processing)
  let url = getElementBgImageUrl(element);
  if (!url) {
    const saved = element.getAttribute(RAW_BG_IMAGE_ATTR);
    if (saved) url = extractBgImageUrl(saved);
  }
  if (!url) {
    restoreRawBackground(element);
    removeMediaSurface(element);
    element.setAttribute(BG_PROCESSED_ATTR, 'skipped');
    return;
  }

  // Fast path: persistent cache hit
  const cached = imageCache.get(url);
  if (cached) {
    if (cached.verdict === 'nsfw') {
      handleNsfwBg(element, url);
    } else {
      handleSafeBg(element, url);
    }
    return;
  }

  try {
    const result = await classifyImageUrl(url, sensitivity, customThreshold);

    // Store in persistent cache — use element dimensions for size
    const elSize = Math.max(element.clientWidth || 0, element.clientHeight || 0);
    const elContext = imageCache.detectContext(url, element);
    const verdict = result.isNSFW ? ('nsfw' as const) : ('safe' as const);
    imageCache.set(url, verdict, result.score, elSize, elContext);

    if (result.isNSFW) {
      handleNsfwBg(element, url);
    } else {
      handleSafeBg(element, url);
    }
  } catch {
    hideRawBackground(element);
    showErrorSurface(element);
    element.setAttribute(BG_PROCESSED_ATTR, 'error');
  }
}

// ---- Unified queue processing ----

/**
 * Process the unified scan queue with concurrency limiting.
 * Images, videos, and background elements share the same concurrency pool.
 */
async function processQueue(): Promise<void> {
  while (activeScanCount < MAX_CONCURRENT) {
    // Drain image queue first, then video, then background
    let task: (() => Promise<void>) | null = null;

    if (scanQueue.length > 0) {
      const img = scanQueue.shift()!;
      queuedImages.delete(img);
      task = () => {
        if (hasFinalStatus(img)) return Promise.resolve();
        processingImages.add(img);
        return processImage(img).finally(() => {
          processingImages.delete(img);
        });
      };
    } else if (videoQueue.length > 0) {
      const video = videoQueue.shift()!;
      task = () => processVideoElement(video);
    } else if (bgQueue.length > 0) {
      const el = bgQueue.shift()!;
      task = () => processBackgroundImage(el);
    }

    if (!task) break;

    activeScanCount++;
    task().finally(() => {
      activeScanCount--;
      totalProcessed++;
      checkAllProcessed();
      processQueue();
    });
  }
}

/**
 * Queue images for scanning.
 */
export function queueImages(images: HTMLImageElement[]): void {
  for (const img of images) {
    if (isOverlayOwnedImage(img) || img.getAttribute(REPLACED_ATTR) === 'true') {
      continue;
    }

    if (hasFinalStatus(img)) {
      restoreExistingImageSurface(img);
      continue;
    }

    if (queuedImages.has(img) || processingImages.has(img)) {
      continue;
    }

    const permanentSkipReason = getPermanentSkipReason(img);
    if (permanentSkipReason) {
      if (img.getAttribute(PROCESSED_ATTR) !== 'skipped') {
        markImageSkipped(img, permanentSkipReason);
      }
      rememberImageSource(img, getScannableSrc(img));
      continue;
    }

    const scannableSrc = getScannableSrc(img);
    if (!scannableSrc) {
      markImagePending(img, 'waiting for real src');
      queuePendingRetryOnLoad(img);
      continue;
    }

    if (shouldQueueImage(img)) {
      // Cap queue size: drop oldest entries on overflow
      if (scanQueue.length >= MAX_QUEUE_SIZE) {
        const dropped = scanQueue.shift()!;
        queuedImages.delete(dropped);
        removeMediaSurface(dropped);
      }
      clearDebugState(img);
      rememberImageSource(img, scannableSrc);
      applyImageMaskStyles(img);
      showPendingSurface(img);
      scanQueue.push(img);
      queuedImages.add(img);
      totalQueued++;
    }
  }
  processQueue();
}

/**
 * Queue video elements for poster thumbnail scanning.
 */
export function queueVideoElements(videos: HTMLVideoElement[]): void {
  for (const video of videos) {
    if (shouldScanVideo(video)) {
      if (videoQueue.length >= MAX_QUEUE_SIZE) {
        const dropped = videoQueue.shift()!;
        removeMediaSurface(dropped);
      }
      showPendingSurface(video);
      videoQueue.push(video);
      totalQueued++;
    } else if (!video.getAttribute(VIDEO_PROCESSED_ATTR)) {
      video.setAttribute(VIDEO_PROCESSED_ATTR, 'skipped');
    }
  }
  processQueue();
}

/**
 * Queue elements with video-related background images for scanning.
 */
export function queueBackgroundImages(elements: HTMLElement[]): void {
  for (const el of elements) {
    if (shouldScanBgImage(el)) {
      if (bgQueue.length >= MAX_QUEUE_SIZE) {
        const dropped = bgQueue.shift()!;
        restoreRawBackground(dropped);
        removeMediaSurface(dropped);
      }
      hideRawBackground(el);
      showPendingSurface(el);
      bgQueue.push(el);
      totalQueued++;
    } else if (!el.getAttribute(BG_PROCESSED_ATTR)) {
      el.setAttribute(BG_PROCESSED_ATTR, 'skipped');
    }
  }
  processQueue();
}

/**
 * Re-queue an image whose src/srcset was updated (lazy-load).
 * Removes the 'skipped' status and queues for scanning.
 */
export function requeueImage(img: HTMLImageElement): void {
  if (isOverlayOwnedImage(img) || img.getAttribute(REPLACED_ATTR) === 'true') {
    return;
  }

  const currentStatus = img.getAttribute(PROCESSED_ATTR);
  const nextSrc = getScannableSrc(img);
  const previousSrc = img.getAttribute(SOURCE_ATTR);
  const sourceChanged = nextSrc !== previousSrc;

  if (!sourceChanged && currentStatus && FINAL_STATUSES.has(currentStatus)) {
    restoreExistingImageSurface(img);
    return;
  }

  if (sourceChanged) {
    bumpImageScanVersion(img);
  }

  clearDebugState(img);
  img.removeAttribute(PENDING_RETRY_ATTR);
  img.removeAttribute(MASKED_ATTR);
  removeMediaSurface(img);

  if (processingImages.has(img) || queuedImages.has(img)) {
    if (nextSrc) {
      rememberImageSource(img, nextSrc);
      markImagePending(img, 'src changed while queued');
    }
    return;
  }

  img.removeAttribute(PROCESSED_ATTR);

  const permanentSkipReason = getPermanentSkipReason(img);
  if (permanentSkipReason) {
    markImageSkipped(img, permanentSkipReason);
    rememberImageSource(img, nextSrc);
    return;
  }

  if (!nextSrc) {
    markImagePending(img, 'waiting for real src');
    queuePendingRetryOnLoad(img);
    return;
  }

  if (developerMode) {
    console.log(`[PG Patrol] Re-queued image: ${nextSrc}`);
  }

  rememberImageSource(img, nextSrc);
  markImagePending(img, 'source changed');
  queueImages([img]);
  observeImagesForViewport([img]);
}

// ---- Collection helpers ----

/**
 * Collect video elements with poster attributes from a DOM subtree.
 */
export function collectVideoThumbnails(root?: Node): HTMLVideoElement[] {
  const container = root instanceof HTMLElement ? root : document;
  return Array.from(container.querySelectorAll('video[poster]')).filter((v) =>
    shouldScanVideo(v as HTMLVideoElement),
  ) as HTMLVideoElement[];
}

/**
 * Collect elements with video-related background images from a DOM subtree.
 */
export function collectBackgroundThumbnails(root?: Node): HTMLElement[] {
  const container = root instanceof HTMLElement ? root : document;
  const candidates = Array.from(
    container.querySelectorAll('div, span, a, figure, section, article, header, li'),
  );
  return candidates.filter((el) => shouldScanBgImage(el as HTMLElement)) as HTMLElement[];
}

/**
 * Scan all images currently on the page.
 */
export async function scanAllImages(): Promise<void> {
  if (!isModelReady()) {
    await loadModel();
  }

  const images = Array.from(document.querySelectorAll('img'));
  queueImages(images);
}

/**
 * Scan all scannable media on the page: images, video posters, and bg thumbnails.
 */
export async function scanAllMedia(): Promise<void> {
  if (!isModelReady()) {
    await loadModel();
  }

  const images = Array.from(document.querySelectorAll('img'));
  queueImages(images);

  const videos = collectVideoThumbnails();
  queueVideoElements(videos);

  const bgElements = collectBackgroundThumbnails();
  queueBackgroundImages(bgElements);
}

export function resetManagedMedia(): void {
  removeAllMediaSurfaces();

  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    if (isOverlayOwnedImage(img)) {
      continue;
    }
    clearImageMaskStyles(img);
    removeBlur(img);
    img.removeAttribute(PROCESSED_ATTR);
    img.removeAttribute(MASKED_ATTR);
    img.removeAttribute(SOURCE_ATTR);
    img.removeAttribute(PENDING_RETRY_ATTR);
    clearDebugState(img);
  }

  for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
    removeBlur(video);
    video.removeAttribute(VIDEO_PROCESSED_ATTR);
  }

  const bgTargets = document.querySelectorAll<HTMLElement>(
    `[${BG_PROCESSED_ATTR}], [${RAW_BG_IMAGE_ATTR}]`,
  );
  for (const target of bgTargets) {
    restoreRawBackground(target);
    removeBlur(target);
    target.removeAttribute(BG_PROCESSED_ATTR);
  }
}

// ---- Viewport-based scanning (IntersectionObserver) ----
// Catches images missed by the MutationObserver (container-level scrolling,
// framework virtual DOM, etc.) and retries 'pending' images that timed out
// waiting for load but are now visible in the viewport.

let viewportObserver: IntersectionObserver | null = null;

/**
 * Start the viewport scanner. Uses IntersectionObserver which works
 * regardless of which element scrolls (window, div, etc.).
 */
export function startViewportScanner(): void {
  if (viewportObserver) return;

  viewportObserver = new IntersectionObserver(
    (entries) => {
      const toQueue: HTMLImageElement[] = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (!(entry.target instanceof HTMLImageElement)) continue;
        if (isOverlayOwnedImage(entry.target)) {
          viewportObserver?.unobserve(entry.target);
          continue;
        }

        const status = entry.target.getAttribute(PROCESSED_ATTR);

        // Already fully processed — stop watching
        if (status && FINAL_STATUSES.has(status)) {
          viewportObserver?.unobserve(entry.target);
          continue;
        }

        if (!queuedImages.has(entry.target) && !processingImages.has(entry.target)) {
          if (status === 'pending') {
            entry.target.removeAttribute(PROCESSED_ATTR);
          }
          toQueue.push(entry.target);
        }
      }
      if (toQueue.length > 0) {
        queueImages(toQueue);
      }
    },
    { rootMargin: '200px' },
  );

  // Observe all currently-unfinished images
  observeAllUnfinishedImages();
}

/**
 * Stop the viewport scanner and release resources.
 */
export function stopViewportScanner(): void {
  viewportObserver?.disconnect();
  viewportObserver = null;
}

/**
 * Register specific images with the viewport observer.
 * Called by the MutationObserver when new images are added to the DOM.
 */
export function observeImagesForViewport(images: HTMLImageElement[]): void {
  if (!viewportObserver) return;
  for (const img of images) {
    if (isOverlayOwnedImage(img)) {
      continue;
    }
    const status = img.getAttribute(PROCESSED_ATTR);
    if (!status || !FINAL_STATUSES.has(status)) {
      viewportObserver.observe(img);
    }
  }
}

/**
 * Scan the DOM and observe all images that haven't reached a final state.
 */
function observeAllUnfinishedImages(): void {
  if (!viewportObserver) return;
  const imgs = document.querySelectorAll<HTMLImageElement>('img');
  for (const img of imgs) {
    if (isOverlayOwnedImage(img)) {
      continue;
    }
    const status = img.getAttribute(PROCESSED_ATTR);
    if (!status || !FINAL_STATUSES.has(status)) {
      viewportObserver.observe(img);
    }
  }
}
