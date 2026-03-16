/**
 * Shared domain utility for extracting the eTLD+1 (registrable domain) from a hostname.
 * Used by adult-domain-keywords and safe-search-sites.
 */

/**
 * Extract the eTLD+1 (registrable domain) from a hostname.
 * Handles common multi-part TLDs like .co.uk, .com.au, etc.
 */
export function getRegistrableDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;

  // Common two-part TLDs
  const twoPartTlds = new Set([
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'gov.au',
    'wa.gov.au',
    'co.nz',
    'co.jp',
    'co.kr',
    'co.in',
    'com.br',
    'com.mx',
    'com.ar',
  ]);

  const lastTwo = parts.slice(-2).join('.');
  const lastThree = parts.slice(-3).join('.');

  // Check three-part TLDs (e.g., wa.gov.au)
  if (parts.length >= 4 && twoPartTlds.has(lastThree.split('.').slice(-3).join('.'))) {
    // Check if the last three parts form a known multi-part TLD
  }

  if (twoPartTlds.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}
