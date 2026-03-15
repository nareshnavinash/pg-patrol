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

// jsdom doesn't implement elementFromPoint — provide a default that returns null
// (individual occlusion tests override this with jest.spyOn)
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}

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
    let elementFromPointSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      elementFromPointSpy?.mockRestore();
      jest.useRealTimers();
    });

    it('hides overlay when a lightbox covers the target', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // Simulate a lightbox element covering the target
      const lightbox = document.createElement('div');
      document.body.appendChild(lightbox);
      elementFromPointSpy = jest.spyOn(document, 'elementFromPoint').mockReturnValue(lightbox);

      // Trigger re-layout (scheduleSurfaceLayout uses rAF → shimmed as setTimeout in jsdom)
      refreshAllMediaSurfaces();
      jest.runAllTimers();

      expect(shell.style.display).toBe('none');
    });

    it('keeps overlay visible when target is the topmost element', () => {
      const target = createTarget(400, 400);
      showBlockedSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // elementFromPoint returns the target itself — no occlusion
      elementFromPointSpy = jest.spyOn(document, 'elementFromPoint').mockReturnValue(target);

      refreshAllMediaSurfaces();
      jest.runAllTimers();

      expect(shell.style.display).not.toBe('none');
    });

    it('keeps overlay visible when target ancestor is topmost', () => {
      const target = createTarget(400, 400);
      showPendingSurface(target);

      const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
      const shell = overlayRoot!.firstElementChild as HTMLElement;

      // elementFromPoint returns an ancestor of the target (e.g., parent container)
      elementFromPointSpy = jest.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);

      refreshAllMediaSurfaces();
      jest.runAllTimers();

      // document.body contains the target, so overlay stays visible
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
