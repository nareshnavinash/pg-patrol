/**
 * @jest-environment jsdom
 */

// Mock replacement-images before importing media-surfaces
jest.mock('../../src/content/replacement-images', () => ({
  getReplacementSrc: jest.fn((_url: string, _w: number, _h: number) => ({
    src: 'data:image/jpeg;base64,mock-stock-photo',
    alt: 'Pleasant scenic view',
  })),
  detectBucket: jest.fn(() => 'square'),
  initReplacementImages: jest.fn(),
  simpleHash: jest.fn((s: string) => Math.abs(s.length)),
  setCachedReplacements: jest.fn(),
}));

// Mock banner-data-uri
jest.mock('../../src/content/banner-data-uri', () => ({
  createBannerDataUri: jest
    .fn()
    .mockReturnValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E'),
}));

import {
  showBlockedSurface,
  showPendingSurface,
  showErrorSurface,
  showSafeImageSurface,
  removeMediaSurface,
  removeAllMediaSurfaces,
  refreshAllMediaSurfaces,
} from '../../src/content/media-surfaces';
import { getReplacementSrc } from '../../src/content/replacement-images';

const OVERLAY_ROOT_ID = 'pg-patrol-media-overlay-root';

describe('media-surfaces', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    removeAllMediaSurfaces();
  });

  function createTarget(width: number, height: number): HTMLDivElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    return el;
  }

  describe('showBlockedSurface', () => {
    it('creates an overlay with a stock photo <img> element', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot).not.toBeNull();
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      const img = shell.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.src).toContain('data:image/jpeg');
      expect(img!.style.objectFit).toBe('cover');
    });

    it('uses neutral alt text on stock photo overlay', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      const img = shell.querySelector('img');
      expect(img).not.toBeNull();
      const alt = img!.alt.toLowerCase();
      expect(alt).not.toContain('blocked');
      expect(alt).not.toContain('restricted');
      expect(alt).not.toContain('nsfw');
      expect(alt).not.toContain('hidden');
    });

    it('falls back to navy shield UI when no stock photos available', () => {
      // Mock getReplacementSrc to return SVG fallback
      (getReplacementSrc as jest.Mock).mockReturnValueOnce({
        src: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        alt: 'Decorative image',
      });

      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('Restricted image hidden');
      expect(overlayRoot!.textContent).toContain('PG Patrol');
    });

    it('uses opaque background with !important', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.getPropertyPriority('opacity')).toBe('important');
    });
  });

  describe('showPendingSurface', () => {
    it('creates a text overlay with "Checking image"', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('Checking image');
    });

    it('uses opaque background with !important and no backdrop-filter', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.getPropertyValue('background')).toContain('30, 27, 75');
      expect(shell.style.getPropertyPriority('background')).toBe('important');
      expect(shell.style.getPropertyPriority('opacity')).toBe('important');
      // backdrop-filter is not recognized by jsdom, so setProperty is silently ignored;
      // verify it's at least not set to a blur/translucent value
      expect(shell.style.getPropertyValue('backdrop-filter')).toBeFalsy();
    });
  });

  describe('showErrorSurface', () => {
    it('creates a text overlay with error message', () => {
      const target = createTarget(400, 400);
      showErrorSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('Unable to verify image');
    });

    it('uses opaque background with !important and no backdrop-filter', () => {
      const target = createTarget(400, 400);
      showErrorSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.getPropertyValue('background')).toContain('30, 27, 75');
      expect(shell.style.getPropertyPriority('background')).toBe('important');
      expect(shell.style.getPropertyPriority('opacity')).toBe('important');
      // backdrop-filter is not recognized by jsdom, so setProperty is silently ignored;
      // verify it's at least not set to a blur/translucent value
      expect(shell.style.getPropertyValue('backdrop-filter')).toBeFalsy();
    });
  });

  describe('occlusion detection (lightbox/modal)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('hides overlay when ancestor has aria-hidden="true" (modal open)', () => {
      // Create a wrapper that simulates main content behind a lightbox
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      const target = document.createElement('div');
      wrapper.appendChild(target);
      jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 400,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      showBlockedSurface(target);
      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // Simulate site opening a lightbox: sets aria-hidden on main content
      wrapper.setAttribute('aria-hidden', 'true');

      refreshAllMediaSurfaces();
      jest.runAllTimers();

      expect(shell.style.display).toBe('none');
    });

    it('hides overlay when ancestor has inert attribute', () => {
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      const target = document.createElement('div');
      wrapper.appendChild(target);
      jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 400,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      showPendingSurface(target);
      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      wrapper.setAttribute('inert', '');

      refreshAllMediaSurfaces();
      jest.runAllTimers();

      expect(shell.style.display).toBe('none');
    });

    it('keeps overlay visible when no ancestor is hidden', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // No aria-hidden or inert set → overlay stays visible
      refreshAllMediaSurfaces();
      jest.runAllTimers();

      expect(shell.style.display).not.toBe('none');
    });

    it('re-shows overlay when aria-hidden is removed (lightbox closed)', () => {
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      const target = document.createElement('div');
      wrapper.appendChild(target);
      jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 400,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      showBlockedSurface(target);
      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // Open lightbox → hidden
      wrapper.setAttribute('aria-hidden', 'true');
      refreshAllMediaSurfaces();
      jest.runAllTimers();
      expect(shell.style.display).toBe('none');

      // Close lightbox → visible again
      wrapper.removeAttribute('aria-hidden');
      refreshAllMediaSurfaces();
      jest.runAllTimers();
      expect(shell.style.display).not.toBe('none');
    });
  });

  describe('showSafeImageSurface', () => {
    it('creates a safe image overlay with the given URL', () => {
      const target = createTarget(400, 400);
      showSafeImageSurface(target, {
        imageUrl: 'https://example.com/safe.jpg',
        backgroundColor: '#f0f0f0',
        objectFit: 'cover',
        objectPosition: 'center',
      });

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot).not.toBeNull();
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      const img = shell.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.src).toBe('https://example.com/safe.jpg');
      expect(img!.style.objectFit).toBe('cover');
      expect(img!.style.objectPosition).toBe('center');
    });

    it('replaces previous surface mode on same target', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);
      showSafeImageSurface(target, {
        imageUrl: 'https://example.com/safe.jpg',
        backgroundColor: '#fff',
        objectFit: 'contain',
        objectPosition: 'top',
      });

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      // Should no longer contain "Checking image" text
      expect(overlayRoot!.textContent).not.toContain('Checking image');
      // Should contain the safe image
      const img = overlayRoot!.querySelector('img');
      expect(img).not.toBeNull();
    });
  });

  describe('removeMediaSurface', () => {
    it('removes the surface for a specific target', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.children.length).toBeGreaterThan(0);

      removeMediaSurface(target);

      // Shell should be removed
      expect(overlayRoot!.children.length).toBe(0);
    });
  });
});
