/**
 * @jest-environment jsdom
 */

import {
  showBlockedSurface,
  showPendingSurface,
  showErrorSurface,
  removeMediaSurface,
  removeAllMediaSurfaces,
  refreshAllMediaSurfaces,
} from '../../src/content/media-surfaces';

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
    it('creates a text overlay with "Restricted image hidden"', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot).not.toBeNull();
      expect(overlayRoot!.textContent).toContain('Restricted image hidden');
      expect(overlayRoot!.textContent).toContain('Sensitive media was removed from view.');
    });

    it('shows PG Patrol eyebrow label', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('PG Patrol');
    });

    it('uses opaque #EEF2FF background with glass border and shadow', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      // jsdom normalizes hex to rgb
      expect(shell.style.background).toContain('238, 242, 255');
      expect(shell.style.border).toContain('rgba(255');
      expect(shell.style.boxShadow).toBeTruthy();
    });

    it('does not apply backdrop-filter (stays opaque)', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.backdropFilter).toBeFalsy();
    });
  });

  describe('showPendingSurface', () => {
    it('creates a text overlay with "Checking image"', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('Checking image');
    });

    it('applies backdrop-filter blur for glassmorphism', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.backdropFilter).toBe('blur(8px)');
    });
  });

  describe('showErrorSurface', () => {
    it('creates a text overlay with error message', () => {
      const target = createTarget(400, 400);
      showErrorSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      expect(overlayRoot!.textContent).toContain('Unable to verify image');
    });

    it('applies backdrop-filter blur for glassmorphism', () => {
      const target = createTarget(400, 400);
      showErrorSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;
      expect(shell.style.backdropFilter).toBe('blur(8px)');
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
        width: 400, height: 400, top: 0, left: 0,
        bottom: 400, right: 400, x: 0, y: 0, toJSON: () => {},
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
        width: 400, height: 400, top: 0, left: 0,
        bottom: 400, right: 400, x: 0, y: 0, toJSON: () => {},
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
        width: 400, height: 400, top: 0, left: 0,
        bottom: 400, right: 400, x: 0, y: 0, toJSON: () => {},
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
