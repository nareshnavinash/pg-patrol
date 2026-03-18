/**
 * Tags whose subtrees should be skipped during text and block scanning.
 * Shared between dom-walker.ts and block-scanner.ts.
 */
export const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'SVG',
  'MATH',
  'IFRAME',
]);
