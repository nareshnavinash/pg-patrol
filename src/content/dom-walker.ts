/**
 * DOM tree walker — finds text nodes suitable for profanity filtering.
 * Skips script, style, code, input, and contenteditable elements.
 *
 * Uses SHOW_ALL with FILTER_REJECT on skip-tag elements to prune entire
 * subtrees in O(1) instead of climbing ancestors per text node.
 */

import { SKIP_TAGS } from '../shared/skip-tags';

/**
 * Walk the DOM tree and return all text nodes that should be filtered.
 * Uses TreeWalker with SHOW_ALL and FILTER_REJECT on skip-tag subtrees
 * to avoid per-node ancestor climbing.
 */
export function getFilterableTextNodes(root: Node = document.body): Text[] {
  const textNodes: Text[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
    acceptNode(node: Node): number {
      // For element nodes: reject entire subtree if it's a skip tag or contenteditable
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        if (el.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (el.getAttribute('data-pg-patrol-processed') === 'true') {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip the element itself but continue into its children
        return NodeFilter.FILTER_SKIP;
      }

      // For text nodes: accept if non-empty
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent || node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }

      // Skip everything else (comments, processing instructions, etc.)
      return NodeFilter.FILTER_SKIP;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  return textNodes;
}
