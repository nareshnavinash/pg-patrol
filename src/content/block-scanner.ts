/**
 * Block-level DOM scanner for Good Vibes Mode.
 * Finds block elements suitable for negative content detection.
 */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'SVG', 'MATH', 'IFRAME',
]);

const BLOCK_SELECTORS = 'article, p, li, h1, h2, h3, h4, h5, h6, blockquote';
const MIN_TEXT_LENGTH = 20;
const OVERLAY_ATTR = 'data-pg-patrol-overlay';

export interface BlockInfo {
  element: HTMLElement;
  text: string;
}

/**
 * Check if an element is inside a skipped tag.
 */
function isInsideSkippedTag(el: HTMLElement): boolean {
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    if (SKIP_TAGS.has(current.tagName)) return true;
    if (current.isContentEditable) return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * Find all block-level elements suitable for content scoring.
 */
export function getFilterableBlocks(root?: Node): BlockInfo[] {
  const container = (root instanceof HTMLElement ? root : document.body);
  const blocks: BlockInfo[] = [];

  // Include the container itself if it matches a block selector
  const candidates: Element[] = [];
  if (container !== document.body && container.matches?.(BLOCK_SELECTORS)) {
    candidates.push(container);
  }
  candidates.push(...Array.from(container.querySelectorAll(BLOCK_SELECTORS)));

  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;

    // Skip already-overlaid blocks
    if (el.getAttribute(OVERLAY_ATTR)) continue;

    // Skip elements inside skipped tags
    if (isInsideSkippedTag(el)) continue;

    const text = el.textContent ?? '';

    // Skip blocks with too little text
    if (text.trim().length < MIN_TEXT_LENGTH) continue;

    blocks.push({ element: el, text });
  }

  return blocks;
}
