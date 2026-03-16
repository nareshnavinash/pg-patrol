/**
 * In-page scan progress pill shown at the top-center of the viewport
 * while PG Patrol is scanning images. Follows the same vanilla DOM
 * pattern as image-filter-banner.ts.
 */

const PILL_ID = 'pg-patrol-scan-progress';

let isRemoved = false;

/**
 * Show or update the scan progress pill with current counts.
 * Creates the pill on first call; updates text on subsequent calls.
 */
export function showScanProgress(processed: number, total: number): void {
  if (total <= 0) return;

  const label = `Scanning\u2026 ${processed}/${total} images`;
  const existing = document.getElementById(PILL_ID);

  if (existing) {
    const span = existing.querySelector<HTMLSpanElement>('[data-pg-scan-label]');
    if (span) span.textContent = label;
    // If previously faded, re-show
    if (isRemoved) {
      isRemoved = false;
      existing.style.opacity = '1';
      existing.style.transform = 'translateX(-50%) translateY(0)';
    }
    return;
  }

  isRemoved = false;

  const pill = document.createElement('div');
  pill.id = PILL_ID;

  Object.assign(pill.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-8px)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'rgba(67, 56, 202, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '9999px',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(67,56,202,0.35), 0 1px 3px rgba(0,0,0,0.12)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '12px',
    color: '#e0e7ff',
    opacity: '0',
    transition: 'opacity 300ms ease, transform 300ms ease',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  });

  pill.innerHTML =
    `<span style="font-size:13px;line-height:1">&#x1F6E1;&#xFE0F;</span>` +
    `<span data-pg-scan-label>${label}</span>`;

  document.body.appendChild(pill);

  // Fade in
  requestAnimationFrame(() => {
    pill.style.opacity = '1';
    pill.style.transform = 'translateX(-50%) translateY(0)';
  });
}

/**
 * Hide the scan progress pill with a fade-out animation, then remove from DOM.
 */
export function hideScanProgress(): void {
  const pill = document.getElementById(PILL_ID);
  if (!pill) return;

  isRemoved = true;
  pill.style.opacity = '0';
  pill.style.transform = 'translateX(-50%) translateY(-8px)';

  setTimeout(() => {
    pill.remove();
  }, 300);
}
