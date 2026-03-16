/**
 * Generate an inline SVG data URI for the NSFW image replacement banner.
 * Uses the same design language as placeholder-square.svg (#EEF2FF background,
 * #818CF8 smiley, #6366F1 text). Data URIs bypass all CSP restrictions for images.
 */
export function createBannerDataUri(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none">',
    '<rect width="300" height="300" fill="#EEF2FF"/>',
    '<circle cx="150" cy="100" r="45" fill="#818CF8"/>',
    '<circle cx="135" cy="88" r="7" fill="white"/>',
    '<circle cx="165" cy="88" r="7" fill="white"/>',
    '<circle cx="135" cy="88" r="3" fill="#1E1B4B"/>',
    '<circle cx="165" cy="88" r="3" fill="#1E1B4B"/>',
    '<path d="M133 118 Q150 138 167 118" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    '<text x="150" y="175" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#6366F1" font-weight="bold">PG Patrol</text>',
    '<text x="150" y="198" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6366F1">Restricted image hidden</text>',
    '<text x="150" y="218" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#A5B4FC">Sensitive media was removed from view.</text>',
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
