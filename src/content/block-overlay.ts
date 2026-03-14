/**
 * Overlay system for Good Vibes Mode.
 * Hides distressing content behind a calm overlay with click-to-reveal.
 *
 * Approach: Wrap original children in a blurred container, then add the
 * overlay as a sibling — so the overlay text stays crisp and unblurred.
 */

import { pauseObserver, resumeObserver } from './observer';

const OVERLAY_ATTR = 'data-pg-patrol-overlay';
const OVERLAY_INNER_ATTR = 'data-pg-patrol-overlay-inner';
const BLUR_WRAPPER_ATTR = 'data-pg-patrol-blur-wrap';
const REVEALED_ATTR = 'data-pg-patrol-revealed';

const CATEGORY_LABELS: Record<string, string> = {
  violence: 'Violence-related',
  war: 'War/Conflict',
  crime: 'Crime-related',
  death: 'Sensitive content',
  disaster: 'Natural disaster',
  terrorism: 'Security-related',
};

/**
 * Check if a background color is dark by parsing rgb/rgba and computing luminance.
 */
function isDarkColor(rgb: string): boolean {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  // Relative luminance approximation
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128;
}

interface ApplyOverlayOptions {
  category?: string;
}

/**
 * Apply a blur overlay to a block element, hiding its content.
 */
export function applyOverlay(element: HTMLElement, options?: ApplyOverlayOptions): void {
  // Don't double-apply, and skip elements the user has manually revealed
  if (element.getAttribute(OVERLAY_ATTR) || element.getAttribute(REVEALED_ATTR)) return;

  // Prevent nested overlays and re-overlay after reveal:
  // skip if an ancestor already has an overlay OR has been revealed
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.getAttribute(OVERLAY_ATTR) || ancestor.getAttribute(REVEALED_ATTR)) return;
    ancestor = ancestor.parentElement;
  }

  // Prevent nested overlays: skip if a descendant already has an overlay
  if (element.querySelector(`[${OVERLAY_ATTR}]`)) return;

  element.setAttribute(OVERLAY_ATTR, 'true');

  // Detect if page has a dark background
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const darkPage = isDarkColor(pageBg);

  // Ensure element is positioned for the absolute overlay
  const computed = getComputedStyle(element);
  if (computed.position === 'static') {
    element.style.position = 'relative';
  }
  element.style.overflow = 'hidden';
  element.style.minHeight = '44px';

  // Wrap existing children in a blurred container
  const blurWrap = document.createElement('div');
  blurWrap.setAttribute(BLUR_WRAPPER_ATTR, 'true');
  Object.assign(blurWrap.style, {
    filter: 'blur(5px)',
    transition: 'filter 300ms ease',
    pointerEvents: 'none',
    userSelect: 'none',
  });

  while (element.firstChild) {
    blurWrap.appendChild(element.firstChild);
  }
  element.appendChild(blurWrap);

  // Create overlay div as a sibling of the blur wrapper (not inside it)
  const overlay = document.createElement('div');
  overlay.setAttribute(OVERLAY_INNER_ATTR, 'true');

  // Frosted blur background
  const overlayBg = darkPage ? 'rgba(31,41,55,0.5)' : 'rgba(255,255,255,0.45)';
  const primaryColor = darkPage ? '#a5b4fc' : '#6366f1';
  const subtextColor = darkPage ? '#d1d5db' : '#6b7280';

  // Measure element height to decide layout: row for short, column for tall
  const elHeight = element.getBoundingClientRect().height;
  const useRow = elHeight < 80;

  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: useRow ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: useRow ? '8px' : '4px',
    background: overlayBg,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: '10',
    minHeight: '44px',
    padding: useRow ? '0 16px' : '12px 16px',
    opacity: '0',
    transition: 'opacity 300ms ease',
    whiteSpace: useRow ? 'nowrap' : 'normal',
  });

  // Build category label HTML if provided
  const categoryKey = options?.category;
  const categoryLabel = categoryKey ? CATEGORY_LABELS[categoryKey] : null;
  const categoryHtml = categoryLabel
    ? useRow
      ? `<span style="font-size:11px;color:${subtextColor}">·</span><span style="font-size:11px;color:${subtextColor}">${categoryLabel}</span>`
      : `<span style="font-size:11px;color:${subtextColor}">${categoryLabel}</span>`
    : '';

  const dotSep = useRow ? `<span style="font-size:11px;color:${subtextColor}">·</span>` : '';

  overlay.innerHTML = useRow
    ? `
      <span style="font-size:16px;line-height:1">🛡️</span>
      <span style="font-size:12px;font-weight:600;color:${primaryColor}">Hidden by PG Patrol</span>
      ${categoryHtml}
      ${dotSep}
      <span style="font-size:11px;color:${subtextColor}">Click to reveal</span>
    `
    : `
      <span style="font-size:24px">🛡️</span>
      <span style="font-size:13px;font-weight:600;color:${primaryColor}">Hidden by PG Patrol</span>
      ${categoryHtml}
      <span style="font-size:11px;color:${subtextColor}">Click to reveal</span>
    `;

  overlay.addEventListener('click', () => {
    // Mark this element and all descendant blocks as revealed
    // so the observer doesn't re-overlay them
    element.setAttribute(REVEALED_ATTR, 'true');
    const childBlocks = element.querySelectorAll('article,p,li,h1,h2,h3,h4,h5,h6,blockquote');
    for (const child of childBlocks) {
      child.setAttribute(REVEALED_ATTR, 'true');
    }
    animateReveal(element);
  }, { once: true });

  element.appendChild(overlay);

  // Trigger fade-in on next frame
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });
}

/**
 * Animate the reveal: fade out overlay and unblur content, then clean up.
 */
function animateReveal(element: HTMLElement): void {
  const overlay = element.querySelector(`[${OVERLAY_INNER_ATTR}]`) as HTMLElement | null;
  const blurWrap = element.querySelector(`[${BLUR_WRAPPER_ATTR}]`) as HTMLElement | null;

  if (overlay) {
    overlay.style.opacity = '0';
  }
  if (blurWrap) {
    blurWrap.style.filter = 'blur(0px)';
  }

  // Clean up after transition
  setTimeout(() => {
    removeOverlay(element);
  }, 300);
}

/**
 * Remove the overlay from a block element, restoring its content.
 */
export function removeOverlay(element: HTMLElement): void {
  // Pause observer so DOM moves don't trigger re-scanning
  pauseObserver();

  // Remove the overlay div
  const inner = element.querySelector(`[${OVERLAY_INNER_ATTR}]`);
  if (inner) {
    inner.remove();
  }

  // Unwrap children from the blur wrapper back into the element
  const blurWrap = element.querySelector(`[${BLUR_WRAPPER_ATTR}]`);
  if (blurWrap) {
    while (blurWrap.firstChild) {
      element.appendChild(blurWrap.firstChild);
    }
    blurWrap.remove();
  }

  // Restore styles
  element.style.overflow = '';
  element.style.minHeight = '';

  // Only reset position if we set it
  if (element.style.position === 'relative') {
    element.style.position = '';
  }

  element.removeAttribute(OVERLAY_ATTR);

  resumeObserver();
}

/**
 * Remove all overlays from the page.
 */
export function removeAllOverlays(): void {
  const overlaid = document.querySelectorAll(`[${OVERLAY_ATTR}]`);
  for (const el of overlaid) {
    if (el instanceof HTMLElement) {
      removeOverlay(el);
    }
  }

  // Clear all revealed marks so re-filtering can re-apply overlays
  const revealed = document.querySelectorAll(`[${REVEALED_ATTR}]`);
  for (const el of revealed) {
    el.removeAttribute(REVEALED_ATTR);
  }
}
