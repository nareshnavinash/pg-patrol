/**
 * Generate an inline SVG data URI for the NSFW image replacement banner.
 * Uses the PG Patrol shield logo on a dark navy (#1e1b4b) background.
 * Data URIs bypass all CSP restrictions for images.
 */
export function createBannerDataUri(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none">',
    '<rect width="300" height="300" fill="#1e1b4b"/>',
    '<path d="M150 30 C150 30 100 45 70 50 C70 95 75 155 150 195 C225 155 230 95 230 50 C200 45 150 30 150 30Z" fill="#6366F1"/>',
    '<text x="150" y="135" text-anchor="middle" font-family="system-ui,sans-serif" font-size="52" font-weight="800" fill="white">PG</text>',
    '<text x="150" y="222" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="0.08em" fill="#818cf8">PG PATROL</text>',
    '<text x="150" y="245" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#f8fafc">Restricted image hidden</text>',
    '<text x="150" y="265" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#a5b4fc">Sensitive media was removed from view.</text>',
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
