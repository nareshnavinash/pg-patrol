/**
 * Safe-search site detection.
 * Sites in this list have platform-enforced content moderation that makes
 * NSFW images essentially impossible. Image scanning is skipped on these
 * sites to avoid false positives and unnecessary ONNX model overhead.
 * Text filtering and Good Vibes Mode continue normally.
 */

import { getRegistrableDomain } from './domain-utils';

const SAFE_SEARCH_SITES = new Set([
  // Search engines (have SafeSearch, also serve Workspace/productivity)
  'google.com',
  'google.co.uk',
  'google.co.in',
  'google.co.jp',
  'google.de',
  'google.fr',
  'google.com.au',
  'google.com.br',
  'google.ca',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',

  // Professional networking
  'linkedin.com',

  // Developer platforms
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',

  // Productivity / Workplace
  'notion.so',
  'figma.com',
  'canva.com',
  'slack.com',
  'trello.com',
  'asana.com',
  'airtable.com',
  'monday.com',

  // Microsoft ecosystem
  'microsoft.com',
  'office.com',
  'live.com',
  'outlook.com',

  // Apple ecosystem
  'apple.com',
  'icloud.com',

  // Education
  'wikipedia.org',
  'khanacademy.org',
  'coursera.org',
  'edx.org',

  // E-commerce (product images, no UGC)
  'amazon.com',
  'amazon.co.uk',
  'amazon.co.jp',
  'amazon.de',
  'amazon.fr',
  'amazon.in',
  'ebay.com',
  'flipkart.com',
  'etsy.com',

  // News (editorial standards)
  'bbc.co.uk',
  'bbc.com',
  'reuters.com',

  // Finance (no UGC images)
  'paypal.com',
  'stripe.com',
]);

/**
 * Check if the given hostname belongs to a safe-search site
 * where image scanning should be skipped.
 */
export function isSafeSearchSite(hostname: string): boolean {
  const domain = getRegistrableDomain(hostname.toLowerCase());
  return SAFE_SEARCH_SITES.has(domain);
}
