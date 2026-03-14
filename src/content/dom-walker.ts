/**
 * DOM tree walker — finds text nodes suitable for profanity filtering.
 * Skips script, style, code, input, and contenteditable elements.
 */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'SVG', 'MATH', 'IFRAME',
]);

/**
 * Check if a node or any of its ancestors should be skipped.
 */
function shouldSkipNode(node: Node): boolean {
  let current: Node | null = node.parentNode;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      if (SKIP_TAGS.has(current.tagName)) return true;
      if (current.isContentEditable) return true;
      if (current.getAttribute('data-pg-patrol-processed') === 'true') return true;
    }
    current = current.parentNode;
  }
  return false;
}

/**
 * Walk the DOM tree and return all text nodes that should be filtered.
 * Uses TreeWalker for efficient traversal.
 */
export function getFilterableTextNodes(root: Node = document.body): Text[] {
  const textNodes: Text[] = [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Text): number {
        // Skip empty or whitespace-only text nodes
        if (!node.textContent || node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip nodes inside elements that shouldn't be filtered
        if (shouldSkipNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node);
  }

  return textNodes;
}
