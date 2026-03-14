/**
 * Image & video thumbnail scanner — detects and replaces NSFW images on the page.
 * Scans <img> elements, <video poster> thumbnails, and CSS background-image
 * elements that are likely video thumbnails.
 */

import {
  classifyImage,
  classifyImageUrl,
  isModelReady,
  loadModel,
} from '../shared/nsfw-detector';
import type { Sensitivity } from '../shared/types';
import { pauseObserver, resumeObserver } from './observer';

const PROCESSED_ATTR = 'data-pg-patrol-img-processed';
const VIDEO_PROCESSED_ATTR = 'data-pg-patrol-vid-processed';
const BG_PROCESSED_ATTR = 'data-pg-patrol-bg-processed';
const DEBUG_BADGE_ATTR = 'data-pg-patrol-debug-badge';
const SOURCE_ATTR = 'data-pg-patrol-img-source';
const MASKED_ATTR = 'data-pg-patrol-img-masked';
const IMAGE_ID_ATTR = 'data-pg-patrol-img-id';
const IMAGE_BANNER_ATTR = 'data-pg-patrol-img-banner';
const IMAGE_BANNER_OWNER_ATTR = 'data-pg-patrol-img-banner-owner';
const PENDING_RETRY_ATTR = 'data-pg-patrol-pending-retry';
const MIN_IMAGE_SIZE = 50; // Skip images smaller than 50px
const MAX_CONCURRENT = 6; // Max concurrent classifications
const LOAD_TIMEOUT_MS = 10_000; // Max time to wait for an image to load
const FINAL_STATUSES = new Set(['safe', 'nsfw', 'error', 'skipped']);

// Known video platform thumbnail URL patterns
const VIDEO_THUMBNAIL_PATTERNS = [
  'ytimg.com',
  'img.youtube.com',
  'vimeocdn.com',
  'dailymotion.com/thumbnail',
  'twimg.com',
  'tiktokcdn.com',
];

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
let nextImageId = 1;

interface ImageBannerState {
  banner: HTMLDivElement;
  parent: HTMLElement;
  resizeObserver: ResizeObserver | null;
}

const imageBannerStates = new WeakMap<HTMLImageElement, ImageBannerState>();
const bannerParentCounts = new WeakMap<HTMLElement, number>();
const repositionedBannerParents = new WeakSet<HTMLElement>();

// URL-based NSFW cache: prevents double-counting on React re-renders
// and enables fast-path re-hide without re-running ML classification.
const nsfwUrlCache = new Set<string>();

// Persistent stylesheet for scan-first blur and final NSFW hiding.
// CSS rules survive React/framework re-renders.
let nsfwStyleEl: HTMLStyleElement | null = null;

/**
 * Inject a persistent CSS stylesheet that blurs unclassified images and
 * fully hides NSFW images while an overlay banner occupies the same slot.
 */
export function ensureNsfwStyleSheet(): void {
  if (nsfwStyleEl?.parentNode) return;
  nsfwStyleEl = document.createElement('style');
  nsfwStyleEl.id = 'pg-patrol-nsfw-styles';
  nsfwStyleEl.textContent =
    // Scan-first: blur ALL images until classified safe/skipped
    `img:not([${PROCESSED_ATTR}="safe"]):not([${PROCESSED_ATTR}="skipped"]):not([${PROCESSED_ATTR}="nsfw"]){` +
    `filter:blur(20px)!important;transition:filter 0.3s ease;}` +
    // NSFW: keep layout but fully hide the original pixels behind a banner overlay.
    `img[${PROCESSED_ATTR}="nsfw"]{` +
    `visibility:hidden!important;pointer-events:none!important;user-select:none!important;` +
    `}` +
    // Videos
    `video[${VIDEO_PROCESSED_ATTR}="nsfw"]{display:none!important;}`;
  (document.head || document.documentElement).appendChild(nsfwStyleEl);
}

/** Returns the CSS text used by the scan-first stylesheet (for Shadow DOM injection). */
export function getNsfwStyleSheetCssText(): string {
  return (
    `img:not([${PROCESSED_ATTR}="safe"]):not([${PROCESSED_ATTR}="skipped"]):not([${PROCESSED_ATTR}="nsfw"]){` +
    `filter:blur(20px)!important;transition:filter 0.3s ease;}` +
    `img[${PROCESSED_ATTR}="nsfw"]{` +
    `visibility:hidden!important;pointer-events:none!important;user-select:none!important;` +
    `}` +
    `video[${VIDEO_PROCESSED_ATTR}="nsfw"]{display:none!important;}`
  );
}

// Completion tracking for pre-blur removal
let totalQueued = 0;
let totalProcessed = 0;
let onAllProcessedCallback: (() => void) | null = null;
let onImageHiddenCallback: ((count: number) => void) | null = null;

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

function checkAllProcessed(): void {
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
    console.log(`[PG Patrol] IMG: ${src} → score=${score.toFixed(3)}, threshold=${thresholdStr}, verdict=${verdict.toUpperCase()}`);
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
  if (url.endsWith('blank.gif') || url.endsWith('placeholder.gif') || url.endsWith('spacer.gif')) return true;
  if (url.startsWith('data:') && url.length < 1000) return true;
  if (url.startsWith('data:image/gif;base64,R0lGOD')) return true; // 1x1 transparent GIF
  return false;
}

// ---- Image scanning ----

function getPermanentSkipReason(img: HTMLImageElement): string | null {
  const w = img.complete ? img.naturalWidth : (img.width || img.naturalWidth);
  const h = img.complete ? img.naturalHeight : (img.height || img.naturalHeight);
  if (w > 0 && w < MIN_IMAGE_SIZE && h > 0 && h < MIN_IMAGE_SIZE) {
    return 'small image';
  }

  const src = getScannableSrc(img);
  if (!src) {
    return img.complete ? 'placeholder image' : null;
  }

  if (src.endsWith('.svg') || src.startsWith('data:image/svg')) {
    return 'svg image';
  }

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

function isImageBannerApplied(img: HTMLImageElement): boolean {
  return (
    img.getAttribute(MASKED_ATTR) === 'true' &&
    Boolean(imageBannerStates.get(img)?.banner?.isConnected)
  );
}

function getOrCreateImageId(img: HTMLImageElement): string {
  const existingId = img.getAttribute(IMAGE_ID_ATTR);
  if (existingId) return existingId;
  const nextId = `pg-patrol-img-${nextImageId++}`;
  img.setAttribute(IMAGE_ID_ATTR, nextId);
  return nextId;
}

function incrementBannerParent(parent: HTMLElement): void {
  const currentCount = bannerParentCounts.get(parent) || 0;
  if (currentCount === 0 && getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
    repositionedBannerParents.add(parent);
  }
  bannerParentCounts.set(parent, currentCount + 1);
}

function decrementBannerParent(parent: HTMLElement): void {
  const currentCount = bannerParentCounts.get(parent) || 0;
  if (currentCount <= 1) {
    bannerParentCounts.delete(parent);
    if (repositionedBannerParents.has(parent)) {
      parent.style.position = '';
      repositionedBannerParents.delete(parent);
    }
    return;
  }
  bannerParentCounts.set(parent, currentCount - 1);
}

function destroyBannerElement(banner: HTMLElement): void {
  if (!banner.isConnected) return;
  const parent = banner.parentElement;
  banner.remove();
  if (parent instanceof HTMLElement) {
    decrementBannerParent(parent);
  }
}

function cleanupOrphanedBanners(parent: HTMLElement): void {
  const banners = Array.from(parent.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute(IMAGE_BANNER_ATTR) === 'true',
  );
  for (const banner of banners) {
    const ownerId = banner.getAttribute(IMAGE_BANNER_OWNER_ATTR);
    if (!ownerId) {
      destroyBannerElement(banner);
      continue;
    }

    const owner = parent.querySelector(`img[${IMAGE_ID_ATTR}="${ownerId}"]`);
    if (!(owner instanceof HTMLImageElement)) {
      destroyBannerElement(banner);
      continue;
    }

    if (
      owner.getAttribute(PROCESSED_ATTR) !== 'nsfw' ||
      owner.getAttribute(MASKED_ATTR) !== 'true'
    ) {
      removeImageBanner(owner);
    }
  }
}

function buildImageBanner(ownerId: string): HTMLDivElement {
  const banner = document.createElement('div');
  banner.setAttribute(IMAGE_BANNER_ATTR, 'true');
  banner.setAttribute(IMAGE_BANNER_OWNER_ATTR, ownerId);
  banner.setAttribute('role', 'note');
  banner.setAttribute('aria-label', 'PG Patrol blocked this image');

  Object.assign(banner.style, {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '16px',
    background:
      'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(30,41,59,0.96))',
    border: '1px solid rgba(148,163,184,0.26)',
    boxShadow: '0 16px 40px rgba(15,23,42,0.32)',
    color: '#e2e8f0',
    fontFamily:
      'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    textAlign: 'center',
    zIndex: '2147483640',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
  });

  banner.innerHTML =
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd">PG Patrol</div>' +
    '<div style="font-size:14px;font-weight:600;line-height:1.3;color:#f8fafc">Restricted image hidden</div>' +
    '<div style="font-size:12px;line-height:1.4;color:#cbd5e1">Sensitive media was removed from view.</div>';

  const consumeEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  banner.addEventListener('click', consumeEvent);
  banner.addEventListener('mousedown', consumeEvent);
  banner.addEventListener('mouseup', consumeEvent);

  return banner;
}

function positionImageBanner(img: HTMLImageElement): void {
  const state = imageBannerStates.get(img);
  if (!state) return;
  if (!img.isConnected || !state.parent.isConnected) {
    removeImageBanner(img);
    return;
  }

  const imgRect = img.getBoundingClientRect();
  const parentRect = state.parent.getBoundingClientRect();
  const fallbackWidth = img.clientWidth || img.width || Math.min(img.naturalWidth || 0, 400) || 160;
  const fallbackHeight = img.clientHeight || img.height || Math.min(img.naturalHeight || 0, 400) || 96;
  const width = Math.max(imgRect.width, fallbackWidth, 44);
  const height = Math.max(imgRect.height, fallbackHeight, 44);
  const top = Math.max(0, imgRect.top - parentRect.top + state.parent.scrollTop);
  const left = Math.max(0, imgRect.left - parentRect.left + state.parent.scrollLeft);
  const borderRadius = getComputedStyle(img).borderRadius || '8px';

  Object.assign(state.banner.style, {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    borderRadius,
  });
}

function removeImageBanner(img: HTMLImageElement): void {
  const state = imageBannerStates.get(img);
  if (!state) return;

  state.resizeObserver?.disconnect();
  state.banner.remove();
  decrementBannerParent(state.parent);
  imageBannerStates.delete(img);
}

function mountImageBanner(img: HTMLImageElement): void {
  const parent = img.parentElement;
  if (!parent) return;
  const ownerId = getOrCreateImageId(img);

  const existingState = imageBannerStates.get(img);
  if (existingState && (existingState.parent !== parent || !existingState.banner.isConnected)) {
    removeImageBanner(img);
  }

  cleanupOrphanedBanners(parent);

  const currentState = imageBannerStates.get(img);
  if (currentState?.banner.isConnected) {
    positionImageBanner(img);
    return;
  }

  const banner = buildImageBanner(ownerId);
  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          positionImageBanner(img);
        })
      : null;

  incrementBannerParent(parent);

  pauseObserver();
  try {
    parent.appendChild(banner);
  } finally {
    resumeObserver();
  }

  imageBannerStates.set(img, { banner, parent, resizeObserver });
  resizeObserver?.observe(img);
  resizeObserver?.observe(parent);
  positionImageBanner(img);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => positionImageBanner(img));
  }
}

function markImageSkipped(img: HTMLImageElement, reason: string): void {
  removeImageBanner(img);
  removeBlur(img);
  img.setAttribute(PROCESSED_ATTR, 'skipped');
  img.removeAttribute(MASKED_ATTR);
  if (developerMode) {
    applyDebugBorder(img, 'skipped');
    logDecision(getScannableSrc(img) || img.src || '(no src)', null, `skipped (${reason})`);
  }
}

function markImagePending(img: HTMLImageElement, reason: string): void {
  removeImageBanner(img);
  img.setAttribute(PROCESSED_ATTR, 'pending');
  img.removeAttribute(MASKED_ATTR);
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
  if (hasFinalStatus(img)) return false;
  if (queuedImages.has(img) || processingImages.has(img)) return false;
  if (getPermanentSkipReason(img)) return false;
  return getScannableSrc(img) !== null;
}

/**
 * Apply blur to an element while it's being scanned.
 */
function applyBlur(el: HTMLElement): void {
  el.style.filter = 'blur(20px)';
  el.style.transition = 'filter 0.3s ease';
}

/**
 * Remove blur from a safe element.
 */
function removeBlur(el: HTMLElement): void {
  el.style.filter = '';
}

/**
 * Hide an NSFW image and mount a banner overlay in the same visual slot.
 * The original source is preserved in data attributes. Count is deduplicated
 * by URL to prevent inflation from re-renders.
 */
function hideImage(img: HTMLImageElement): void {
  const source = img.getAttribute(SOURCE_ATTR) || getScannableSrc(img) || img.src;
  img.setAttribute(PROCESSED_ATTR, 'nsfw');
  img.setAttribute(MASKED_ATTR, 'true');
  ensureNsfwStyleSheet();

  // Dedup: only count each unique URL once
  if (source && !nsfwUrlCache.has(source)) {
    nsfwUrlCache.add(source);
    replacedCount++;
    onImageHiddenCallback?.(replacedCount);
  }

  if (!isImageBannerApplied(img)) {
    mountImageBanner(img);
  }

  removeBlur(img);
}

/**
 * Process a single image: classify and handle result.
 */
async function processImage(img: HTMLImageElement): Promise<void> {
  if (hasFinalStatus(img)) {
    return;
  }

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

  // Fast path: URL already known NSFW (e.g., React re-rendered element)
  if (nsfwUrlCache.has(attemptSrc)) {
    hideImage(img);
    if (developerMode) {
      logDecision(attemptSrc, null, 'nsfw (cached)');
    }
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
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), LOAD_TIMEOUT_MS),
        ),
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
      removeImageBanner(img);
      img.setAttribute(PROCESSED_ATTR, 'error');
      img.removeAttribute(MASKED_ATTR);
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
      processingImages.delete(img);
      queueMicrotask(() => requeueImage(img));
      return;
    }

    const result = await classifyImage(img, sensitivity, customThreshold);

    const finalSrc = getScannableSrc(img);
    if (!finalSrc || finalSrc !== attemptSrc) {
      markImagePending(img, 'src changed during classification');
      processingImages.delete(img);
      queueMicrotask(() => requeueImage(img));
      return;
    }

    if (result.isNSFW) {
      hideImage(img);
      if (developerMode) {
        logDecision(finalSrc, result.score, 'nsfw');
      }
    } else {
      removeImageBanner(img);
      removeBlur(img);
      img.setAttribute(PROCESSED_ATTR, 'safe');
      img.removeAttribute(MASKED_ATTR);
      if (developerMode) {
        showScoreOverlay(img, result.score, 'safe');
        applyDebugBorder(img, 'safe');
        logDecision(finalSrc, result.score, 'safe');
      }
    }
    rememberImageSource(img, finalSrc);
  } catch {
    // Fail-safe: keep blur on the image (we don't know if it's NSFW)
    removeImageBanner(img);
    img.setAttribute(PROCESSED_ATTR, 'error');
    img.removeAttribute(MASKED_ATTR);
    rememberImageSource(img, attemptSrc);
    if (developerMode) {
      applyDebugBorder(img, 'error');
      logDecision(img.src || '(unknown)', null, 'error (fail-safe blur)');
    }
  }
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
    video.setAttribute(VIDEO_PROCESSED_ATTR, 'skipped');
    return;
  }

  try {
    // Blur already applied at queue time

    const result = await classifyImageUrl(video.poster, sensitivity, customThreshold);

    if (result.isNSFW) {
      video.setAttribute(VIDEO_PROCESSED_ATTR, 'nsfw');
      ensureNsfwStyleSheet();
      if (video.poster && !nsfwUrlCache.has(video.poster)) {
        nsfwUrlCache.add(video.poster);
        replacedCount++;
        onImageHiddenCallback?.(replacedCount);
      }
    } else {
      removeBlur(video);
      video.setAttribute(VIDEO_PROCESSED_ATTR, 'safe');
    }
  } catch {
    // Fail-safe: keep blur on the video
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
 * Check if an element's background-image is likely a video thumbnail.
 */
export function isVideoThumbnailBg(element: HTMLElement): boolean {
  if (element.getAttribute(BG_PROCESSED_ATTR)) return false;

  const bg = element.style.backgroundImage || '';
  const url = extractBgImageUrl(bg);
  if (!url) return false;

  // Skip SVGs and small data URIs
  if (url.endsWith('.svg') || url.startsWith('data:image/svg')) return false;
  if (url.startsWith('data:') && url.length < 1000) return false;

  // Known video platform thumbnail URLs
  if (VIDEO_THUMBNAIL_PATTERNS.some((p) => url.includes(p))) return true;

  // Elements with video-related CSS class names or IDs
  const classAndId = (
    (element.className || '') + ' ' +
    (element.id || '') + ' ' +
    (element.parentElement?.className || '')
  ).toLowerCase();

  if (/video|player|thumb|poster|preview/.test(classAndId)) {
    return true;
  }

  return false;
}

/**
 * Process an element with a background-image: classify and handle result.
 * Clears the background-image and inserts a banner if NSFW.
 */
async function processBackgroundImage(element: HTMLElement): Promise<void> {
  if (element.getAttribute(BG_PROCESSED_ATTR)) return;

  const url = extractBgImageUrl(element.style.backgroundImage || '');
  if (!url) {
    element.setAttribute(BG_PROCESSED_ATTR, 'skipped');
    return;
  }

  try {
    // Blur already applied at queue time

    const result = await classifyImageUrl(url, sensitivity, customThreshold);

    if (result.isNSFW) {
      element.setAttribute(BG_PROCESSED_ATTR, 'nsfw');
      element.style.backgroundImage = 'none';
      element.style.filter = '';
      element.style.setProperty('display', 'none', 'important');
      if (url && !nsfwUrlCache.has(url)) {
        nsfwUrlCache.add(url);
        replacedCount++;
        onImageHiddenCallback?.(replacedCount);
      }
    } else {
      removeBlur(element);
      element.setAttribute(BG_PROCESSED_ATTR, 'safe');
    }
  } catch {
    // Fail-safe: keep blur on the element
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
    if (img.parentElement) {
      cleanupOrphanedBanners(img.parentElement);
    }

    if (hasFinalStatus(img) || queuedImages.has(img) || processingImages.has(img)) {
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
      clearDebugState(img);
      rememberImageSource(img, scannableSrc);
      applyBlur(img); // Blur immediately on queue (fail-safe)
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
      applyBlur(video); // Blur immediately on queue (fail-safe)
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
    if (isVideoThumbnailBg(el)) {
      applyBlur(el); // Blur immediately on queue (fail-safe)
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
  if (img.parentElement) {
    cleanupOrphanedBanners(img.parentElement);
  }

  const currentStatus = img.getAttribute(PROCESSED_ATTR);
  const nextSrc = getScannableSrc(img);
  const previousSrc = img.getAttribute(SOURCE_ATTR);
  const sourceChanged = nextSrc !== previousSrc;

  if (processingImages.has(img) || queuedImages.has(img)) {
    return;
  }

  if (currentStatus === 'nsfw' && !sourceChanged) {
    if (!isImageBannerApplied(img)) {
      hideImage(img);
    }
    return;
  }

  if (!sourceChanged && currentStatus && FINAL_STATUSES.has(currentStatus)) {
    return;
  }

  clearDebugState(img);
  img.removeAttribute(PENDING_RETRY_ATTR);
  img.removeAttribute(PROCESSED_ATTR);
  img.removeAttribute(MASKED_ATTR);
  removeImageBanner(img);

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
  queueImages([img]);
  observeImagesForViewport([img]);
}

// ---- Collection helpers ----

/**
 * Collect video elements with poster attributes from a DOM subtree.
 */
export function collectVideoThumbnails(root?: Node): HTMLVideoElement[] {
  const container = root instanceof HTMLElement ? root : document;
  return Array.from(container.querySelectorAll('video[poster]')).filter(
    (v) => shouldScanVideo(v as HTMLVideoElement),
  ) as HTMLVideoElement[];
}

/**
 * Collect elements with video-related background images from a DOM subtree.
 */
export function collectBackgroundThumbnails(root?: Node): HTMLElement[] {
  const container = root instanceof HTMLElement ? root : document;
  const candidates = Array.from(container.querySelectorAll('div, span, a, figure'));
  return candidates.filter((el) => isVideoThumbnailBg(el as HTMLElement)) as HTMLElement[];
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
    const status = img.getAttribute(PROCESSED_ATTR);
    if (!status || !FINAL_STATUSES.has(status)) {
      viewportObserver.observe(img);
    }
  }
}
