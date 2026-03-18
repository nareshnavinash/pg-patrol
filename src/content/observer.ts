/**
 * MutationObserver for dynamic content — watches for new/changed text nodes,
 * images, and video elements added to the DOM after initial scan.
 * Also watches for src/srcset attribute changes to catch lazy-loaded images.
 */

import { getFilterableTextNodes } from './dom-walker';

type TextNodeCallback = (nodes: Text[]) => void;
type ImageCallback = (images: HTMLImageElement[]) => void;
type VideoCallback = (videos: HTMLVideoElement[]) => void;
type ImageAttrCallback = (img: HTMLImageElement) => void;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;
let pendingMutations: MutationRecord[] = [];
const attrChangedImages = new Set<HTMLImageElement>();
let attrFlushScheduled = false;

const DEBOUNCE_MS = 100;
const MAX_PENDING_MUTATIONS = 1000;

/**
 * Start observing the DOM for changes.
 * Calls onTextNodes when new text content appears,
 * onImages when new images are added,
 * onVideos when new video elements with poster attributes are added,
 * and onImageAttrChange when an existing image's src/srcset changes.
 */
export function startObserver(
  onTextNodes: TextNodeCallback,
  onImages?: ImageCallback,
  onVideos?: VideoCallback,
  onImageAttrChange?: ImageAttrCallback,
): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    // Skip mutations caused by our own replacements
    if (isProcessing) return;

    // Collect attribute-changed images and flush on next microtask
    if (onImageAttrChange) {
      let hasAttrChanges = false;
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLImageElement &&
          (mutation.attributeName === 'src' || mutation.attributeName === 'srcset')
        ) {
          attrChangedImages.add(mutation.target);
          hasAttrChanges = true;
        }
      }
      if (hasAttrChanges && !attrFlushScheduled) {
        attrFlushScheduled = true;
        queueMicrotask(() => {
          attrFlushScheduled = false;
          for (const img of attrChangedImages) {
            onImageAttrChange!(img);
          }
          attrChangedImages.clear();
        });
      }
    }

    // Accumulate mutations across debounce cycles so none are lost
    if (pendingMutations.length + mutations.length > MAX_PENDING_MUTATIONS) {
      // Keep only the most recent half to bound memory
      pendingMutations = pendingMutations.slice(-Math.floor(MAX_PENDING_MUTATIONS / 2));
    }
    pendingMutations.push(...mutations);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      const mutationsToProcess = pendingMutations;
      pendingMutations = [];

      const textNodes: Text[] = [];
      const images: HTMLImageElement[] = [];
      const videos: HTMLVideoElement[] = [];

      for (const mutation of mutationsToProcess) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Text) {
              // Direct text node added
              if (node.textContent && node.textContent.trim().length > 0) {
                textNodes.push(node);
              }
            } else if (node instanceof HTMLElement) {
              // Element added — scan its subtree for text nodes
              const childTextNodes = getFilterableTextNodes(node);
              textNodes.push(...childTextNodes);

              // Collect images
              if (onImages) {
                if (node instanceof HTMLImageElement) {
                  images.push(node);
                }
                const childImages = node.querySelectorAll('img');
                images.push(...Array.from(childImages));
              }

              // Collect video elements with poster attributes
              if (onVideos) {
                if (node instanceof HTMLVideoElement && node.poster) {
                  videos.push(node);
                }
                const childVideos = node.querySelectorAll('video[poster]');
                videos.push(...(Array.from(childVideos) as HTMLVideoElement[]));
              }
            }
          }
        } else if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (
            target instanceof Text &&
            target.textContent &&
            target.textContent.trim().length > 0
          ) {
            textNodes.push(target);
          }
        }
      }

      if (textNodes.length > 0) {
        onTextNodes(textNodes);
      }
      if (onImages && images.length > 0) {
        onImages(images);
      }
      if (onVideos && videos.length > 0) {
        onVideos(videos);
      }
    }, DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  });
}

/**
 * Temporarily pause the observer during our own DOM modifications
 * to prevent infinite loops.
 */
export function pauseObserver(): void {
  isProcessing = true;
}

/**
 * Resume the observer after our modifications are done.
 */
export function resumeObserver(): void {
  isProcessing = false;
}

/**
 * Stop observing the DOM entirely.
 */
export function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingMutations = [];
  isProcessing = false;
}
