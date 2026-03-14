/**
 * Adult domain detection using exact eTLD+1 matching.
 * Used to blanket-blur all images on known adult sites without running the ML model.
 *
 * Uses a Set of exact domains (fast O(1) lookup) plus .xxx TLD check.
 * No keyword substring matching — eliminates false positives completely.
 */

import { getRegistrableDomain } from './domain-utils';

const ADULT_DOMAINS = new Set([
  // Major tube sites
  'pornhub.com',
  'xvideos.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'xnxx.com',
  'spankbang.com',
  'eporner.com',
  'thumbzilla.com',
  'motherless.com',
  'xtube.com',
  'porntube.com',
  'porntrex.com',
  'tubegalore.com',
  'alohatube.com',
  'drtuber.com',
  'txxx.com',
  'voyeurhit.com',
  'hqporner.com',
  'heavy-r.com',
  'efukt.com',
  'daftsex.com',
  'sxyprn.com',
  'fuq.com',
  'beeg.com',

  // Studios / premium
  'brazzers.com',
  'bangbros.com',
  'realitykings.com',
  'mofos.com',
  'tushy.com',
  'vixen.com',
  'blacked.com',
  'babes.com',
  'metart.com',
  'hegre.com',
  'playboy.com',
  'penthouse.com',
  'hustler.com',
  'naughtyamerica.com',

  // Creator / cam platforms
  'onlyfans.com',
  'chaturbate.com',
  'livejasmin.com',
  'stripchat.com',
  'bongacams.com',
  'myfreecams.com',
  'flirt4free.com',
  'camsoda.com',
  'camwhores.tv',
  'fapello.com',

  // Hentai / anime
  'nhentai.net',
  'e-hentai.org',
  'gelbooru.com',
  'danbooru.donmai.us',
  'rule34.xxx',
  'rule34.paheal.net',

  // Dating / hookup
  'adultfriendfinder.com',
  'ashleymadison.com',
  'fetlife.com',

  // Erotica / other
  'literotica.com',
  'eroshare.com',
  'fapvid.com',
  'nudevista.com',
  'porngifs.com',

  // Explicit short-name domains
  'sex.com',
  'smut.com',
  'porn.com',
  'nude.com',
  'xxx.com',
]);

/**
 * Determine if the given hostname belongs to a known adult site.
 */
export function isAdultDomain(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Check .xxx TLD
  if (h.endsWith('.xxx')) return true;

  // Check exact eTLD+1 match
  const domain = getRegistrableDomain(h);
  if (ADULT_DOMAINS.has(domain)) return true;

  // Also check with www stripped (handles subdomains like www.pornhub.com)
  // The registrable domain already handles this, but check subdomains too
  // e.g., "de.pornhub.com" → registrable = "pornhub.com"
  return false;
}
