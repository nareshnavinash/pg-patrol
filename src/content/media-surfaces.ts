const OVERLAY_ROOT_ID = 'pg-patrol-media-overlay-root';
const OVERLAY_OWNED_ATTR = 'data-pg-patrol-overlay-owned';

type SurfaceMode = 'pending' | 'blocked' | 'error' | 'safe-image' | 'safe-background';

interface SurfaceRecord {
  target: HTMLElement;
  shell: HTMLDivElement;
  content: HTMLElement;
  mode: SurfaceMode;
}

interface MessageSurfaceOptions {
  eyebrow?: string;
  title: string;
  body: string;
}

interface SafeImageSurfaceOptions {
  imageUrl: string;
  objectFit: string;
  objectPosition: string;
  backgroundColor: string;
}

interface SafeBackgroundSurfaceOptions {
  imageUrl: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  backgroundColor: string;
}

let overlayRoot: HTMLDivElement | null = null;
let layoutScheduled = false;
let listenersBound = false;

const sharedResizeObserver =
  typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        scheduleSurfaceLayout();
      })
    : null;

const surfaceStates = new WeakMap<HTMLElement, SurfaceRecord>();
const activeSurfaces = new Set<SurfaceRecord>();

function pruneDetachedSurfaces(): void {
  for (const record of Array.from(activeSurfaces)) {
    if (!record.target.isConnected) {
      sharedResizeObserver?.unobserve(record.target);
      record.shell.remove();
      activeSurfaces.delete(record);
      surfaceStates.delete(record.target);
    }
  }
}

function runOnNextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 0);
}

function ensureOverlayRoot(): HTMLDivElement {
  if (overlayRoot?.isConnected) {
    return overlayRoot;
  }

  overlayRoot = document.createElement('div');
  overlayRoot.id = OVERLAY_ROOT_ID;
  overlayRoot.setAttribute(OVERLAY_OWNED_ATTR, 'true');
  Object.assign(overlayRoot.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
    overflow: 'visible',
    contain: 'layout style paint',
  });

  (document.documentElement || document.body || document).appendChild(overlayRoot);
  return overlayRoot;
}

function scheduleSurfaceLayout(): void {
  if (layoutScheduled) {
    return;
  }

  layoutScheduled = true;
  runOnNextFrame(() => {
    layoutScheduled = false;
    pruneDetachedSurfaces();
    for (const record of Array.from(activeSurfaces)) {
      positionSurface(record);
    }
  });
}

function bindGlobalListeners(): void {
  if (listenersBound || typeof window === 'undefined') {
    return;
  }

  const relayout = () => scheduleSurfaceLayout();
  window.addEventListener('scroll', relayout, true);
  window.addEventListener('resize', relayout, { passive: true });
  window.addEventListener('orientationchange', relayout);
  listenersBound = true;
}

function createShell(): HTMLDivElement {
  const shell = document.createElement('div');
  shell.setAttribute(OVERLAY_OWNED_ATTR, 'true');
  Object.assign(shell.style, {
    position: 'fixed',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'none',
    zIndex: '2147483646',
  });
  return shell;
}

function createMessageContent(): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute(OVERLAY_OWNED_ATTR, 'true');
  Object.assign(content.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '16px',
    boxSizing: 'border-box',
    textAlign: 'center',
    fontFamily:
      'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  });
  return content;
}

function getOrCreateSurface(target: HTMLElement): SurfaceRecord {
  pruneDetachedSurfaces();
  const current = surfaceStates.get(target);
  if (current?.shell.isConnected) {
    return current;
  }

  const shell = createShell();
  const content = createMessageContent();
  shell.appendChild(content);
  ensureOverlayRoot().appendChild(shell);

  sharedResizeObserver?.observe(target);

  const record: SurfaceRecord = {
    target,
    shell,
    content,
    mode: 'pending',
  };

  surfaceStates.set(target, record);
  activeSurfaces.add(record);
  bindGlobalListeners();
  positionSurface(record);
  return record;
}

function ensureChild<T extends HTMLElement>(
  parent: HTMLElement,
  selector: string,
  factory: () => T,
): T {
  const existing = parent.querySelector<T>(selector);
  if (existing) {
    return existing;
  }

  const next = factory();
  parent.appendChild(next);
  return next;
}

function positionSurface(record: SurfaceRecord): void {
  if (!record.target.isConnected) {
    removeMediaSurface(record.target);
    return;
  }

  const rect = record.target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    record.shell.style.display = 'none';
    return;
  }

  const computed = getComputedStyle(record.target);
  const borderRadius = computed.borderRadius || '0px';

  Object.assign(record.shell.style, {
    display: record.mode === 'safe-image' ? 'block' : 'flex',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius,
  });
}

function fillMessageSurface(record: SurfaceRecord, options: MessageSurfaceOptions, background: string): void {
  record.mode = options.title === 'Checking image' ? 'pending' : options.title === 'Unable to verify image' ? 'error' : 'blocked';
  record.shell.innerHTML = '';
  if (!record.content.isConnected || record.content.parentElement !== record.shell) {
    record.content = createMessageContent();
  }
  record.shell.appendChild(record.content);
  Object.assign(record.shell.style, {
    background,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 40px rgba(15,23,42,0.35), 0 2px 4px rgba(0,0,0,0.15)',
  });
  record.content.innerHTML =
    `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd">${options.eyebrow || 'PG Patrol'}</div>` +
    `<div style="font-size:14px;font-weight:600;line-height:1.3;color:#f8fafc">${options.title}</div>` +
    `<div style="font-size:12px;line-height:1.4;color:#cbd5e1">${options.body}</div>`;
  positionSurface(record);
}

export function isOverlayOwnedImage(img: HTMLImageElement): boolean {
  return img.getAttribute(OVERLAY_OWNED_ATTR) === 'true';
}

export function showPendingSurface(target: HTMLElement): void {
  const record = getOrCreateSurface(target);
  fillMessageSurface(
    record,
    {
      title: 'Checking image',
      body: 'PG Patrol is reviewing this media before it appears.',
    },
    'rgba(15, 23, 42, 0.75)',
  );
}

export function showBlockedSurface(target: HTMLElement): void {
  const record = getOrCreateSurface(target);
  record.mode = 'blocked';
  record.shell.innerHTML = '';
  if (!record.content.isConnected || record.content.parentElement !== record.shell) {
    record.content = createMessageContent();
  }
  record.shell.appendChild(record.content);
  Object.assign(record.shell.style, {
    background: '#EEF2FF',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(67,56,202,0.15), 0 1px 3px rgba(0,0,0,0.08)',
  });
  record.content.innerHTML =
    `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1">PG Patrol</div>` +
    `<div style="font-size:14px;font-weight:600;line-height:1.3;color:#1e1b4b">Restricted image hidden</div>` +
    `<div style="font-size:12px;line-height:1.4;color:#4338ca">Sensitive media was removed from view.</div>`;
  positionSurface(record);
}

export function showErrorSurface(target: HTMLElement): void {
  const record = getOrCreateSurface(target);
  fillMessageSurface(
    record,
    {
      title: 'Unable to verify image',
      body: 'PG Patrol kept this media covered because it could not be checked safely.',
    },
    'rgba(15, 23, 42, 0.75)',
  );
}

export function showSafeImageSurface(
  target: HTMLElement,
  options: SafeImageSurfaceOptions,
): void {
  const record = getOrCreateSurface(target);
  record.mode = 'safe-image';
  record.shell.innerHTML = '';
  Object.assign(record.shell.style, {
    background: options.backgroundColor,
    border: 'none',
    boxShadow: 'none',
  });

  const safeImage = ensureChild(record.shell, `img[${OVERLAY_OWNED_ATTR}="true"]`, () => {
    const img = document.createElement('img');
    img.setAttribute(OVERLAY_OWNED_ATTR, 'true');
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      userSelect: 'none',
    });
    return img;
  });

  safeImage.src = options.imageUrl;
  safeImage.alt = '';
  safeImage.style.objectFit = options.objectFit;
  safeImage.style.objectPosition = options.objectPosition;
  positionSurface(record);
}

export function showSafeBackgroundSurface(
  target: HTMLElement,
  options: SafeBackgroundSurfaceOptions,
): void {
  const record = getOrCreateSurface(target);
  record.mode = 'safe-background';
  record.shell.innerHTML = '';
  Object.assign(record.shell.style, {
    backgroundColor: options.backgroundColor,
    backgroundImage: `url("${options.imageUrl.replace(/"/g, '\\"')}")`,
    backgroundSize: options.backgroundSize,
    backgroundPosition: options.backgroundPosition,
    backgroundRepeat: options.backgroundRepeat,
    border: 'none',
    boxShadow: 'none',
  });
  positionSurface(record);
}

export function removeMediaSurface(target: HTMLElement): void {
  const record = surfaceStates.get(target);
  if (!record) {
    return;
  }

  sharedResizeObserver?.unobserve(target);
  record.shell.remove();
  activeSurfaces.delete(record);
  surfaceStates.delete(target);
}

export function removeAllMediaSurfaces(): void {
  for (const record of Array.from(activeSurfaces)) {
    sharedResizeObserver?.unobserve(record.target);
    record.shell.remove();
    surfaceStates.delete(record.target);
    activeSurfaces.delete(record);
  }
}

export function refreshAllMediaSurfaces(): void {
  scheduleSurfaceLayout();
}
