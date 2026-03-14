/**
 * Shadow DOM scanner — detects open shadow roots and extends PG Patrol's
 * image scanning into them. Injects the scan-first blur CSS via
 * adoptedStyleSheets and scans for <img> elements inside each shadow root.
 */

import { getNsfwStyleSheetCssText, queueImages, observeImagesForViewport } from './image-scanner';

/** Tracks shadow roots we've already registered. */
const registeredRoots = new WeakSet<ShadowRoot>();

/** MutationObservers inside shadow roots (for cleanup). */
const shadowObservers = new Map<ShadowRoot, MutationObserver>();

/** Top-level observer watching for new elements with shadow roots. */
let bodyObserver: MutationObserver | null = null;

/** Shared CSSStyleSheet for injection via adoptedStyleSheets. */
let sharedSheet: CSSStyleSheet | null = null;

function getSharedSheet(): CSSStyleSheet {
  if (!sharedSheet) {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(getNsfwStyleSheetCssText());
  }
  return sharedSheet;
}

/**
 * Inject the scan-first CSS into a shadow root and scan its images.
 */
function registerShadowRoot(shadowRoot: ShadowRoot): void {
  if (registeredRoots.has(shadowRoot)) return;
  registeredRoots.add(shadowRoot);

  // Inject shared CSS via adoptedStyleSheets (standard, performant)
  try {
    const sheet = getSharedSheet();
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
  } catch {
    // Fallback: inject a <style> element directly
    const style = document.createElement('style');
    style.textContent = getNsfwStyleSheetCssText();
    shadowRoot.appendChild(style);
  }

  // Scan existing images inside this shadow root
  const images = Array.from(shadowRoot.querySelectorAll<HTMLImageElement>('img'));
  if (images.length > 0) {
    queueImages(images);
    observeImagesForViewport(images);
  }

  // Watch for dynamically added images inside the shadow root
  const observer = new MutationObserver((mutations) => {
    const newImages: HTMLImageElement[] = [];
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          newImages.push(node);
        } else if (node instanceof HTMLElement) {
          const imgs = node.querySelectorAll<HTMLImageElement>('img');
          for (const img of imgs) {
            newImages.push(img);
          }
          // Also check for nested shadow roots
          checkForShadowRoots(node);
        }
      }
    }
    if (newImages.length > 0) {
      queueImages(newImages);
      observeImagesForViewport(newImages);
    }
  });

  observer.observe(shadowRoot, { childList: true, subtree: true });
  shadowObservers.set(shadowRoot, observer);
}

/**
 * Recursively check an element and its descendants for open shadow roots.
 */
function checkForShadowRoots(el: Element): void {
  if (el.shadowRoot) {
    registerShadowRoot(el.shadowRoot);
  }
  // Check children (shadow roots can be nested)
  const children = el.querySelectorAll('*');
  for (const child of children) {
    if (child.shadowRoot) {
      registerShadowRoot(child.shadowRoot);
    }
  }
}

/**
 * Start scanning for shadow roots in the document.
 * Uses a MutationObserver on document.body to detect new elements
 * and checks them for open shadow roots.
 */
export function startShadowDomScanner(): void {
  if (bodyObserver) return;

  // Scan all existing elements for shadow roots
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      registerShadowRoot(el.shadowRoot);
    }
  }

  // Watch for new elements added to the DOM
  bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          checkForShadowRoots(node);
        }
      }
    }
  });

  const target = document.body || document.documentElement;
  bodyObserver.observe(target, { childList: true, subtree: true });
}

/**
 * Stop the shadow DOM scanner and release all observers.
 */
export function stopShadowDomScanner(): void {
  bodyObserver?.disconnect();
  bodyObserver = null;

  for (const observer of shadowObservers.values()) {
    observer.disconnect();
  }
  shadowObservers.clear();

  sharedSheet = null;
}
