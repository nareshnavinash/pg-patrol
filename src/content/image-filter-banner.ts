/**
 * Subtle notification banner shown when PG Patrol has filtered images on a page.
 * Supports live count updates (e.g., as infinite-scroll loads more images).
 * Auto-dismisses after inactivity, reappears when new images are filtered.
 */

const BANNER_ID = 'pg-patrol-image-banner';
const AUTO_DISMISS_MS = 6000;

let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let isDismissed = false;

/**
 * Show or update the banner with the current filtered image count.
 * Creates the banner on first call; updates the count on subsequent calls.
 * Resets the auto-dismiss timer on each update.
 */
export function showImageFilterBanner(count: number): void {
  if (count <= 0) return;

  const label = count === 1 ? '1 image filtered' : `${count} images filtered`;
  const existing = document.getElementById(BANNER_ID);

  if (existing) {
    // Update count text in existing banner
    const span = existing.querySelector<HTMLSpanElement>('[data-pg-banner-label]');
    if (span) span.textContent = `${label} by PG Patrol`;
    resetAutoDismiss(existing);
    // If previously faded out, re-show
    if (isDismissed) {
      isDismissed = false;
      existing.style.opacity = '1';
      existing.style.transform = 'translateY(0)';
    }
    return;
  }

  isDismissed = false;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;

  Object.assign(banner.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: 'rgba(67, 56, 202, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '8px',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(67,56,202,0.35), 0 1px 3px rgba(0,0,0,0.12)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '12px',
    color: '#e0e7ff',
    cursor: 'pointer',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 300ms ease, transform 300ms ease',
    pointerEvents: 'auto',
  });

  banner.innerHTML =
    `<span style="font-size:14px;line-height:1">🛡️</span>` +
    `<span data-pg-banner-label>${label} by PG Patrol</span>`;

  banner.addEventListener('click', () => dismiss(banner), { once: true });

  document.body.appendChild(banner);

  // Fade in
  requestAnimationFrame(() => {
    banner.style.opacity = '1';
    banner.style.transform = 'translateY(0)';
  });

  resetAutoDismiss(banner);
}

function resetAutoDismiss(banner: HTMLElement): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => dismiss(banner), AUTO_DISMISS_MS);
}

function dismiss(banner: HTMLElement): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  isDismissed = true;
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(8px)';
  // Don't remove from DOM — keep it so updates can re-show it
}

/**
 * Remove the banner immediately (e.g., on page teardown or re-filter).
 */
export function removeImageFilterBanner(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  isDismissed = false;
  document.getElementById(BANNER_ID)?.remove();
}
