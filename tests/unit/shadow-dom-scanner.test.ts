/**
 * @jest-environment jsdom
 */

import { startShadowDomScanner, stopShadowDomScanner } from '../../src/content/shadow-dom-scanner';

// Mock image-scanner exports
const mockQueueImages = jest.fn();
const mockObserveImagesForViewport = jest.fn();

jest.mock('../../src/content/image-scanner', () => ({
  getNsfwStyleSheetCssText: jest
    .fn()
    .mockReturnValue(
      'img:not([data-pg-patrol-img-processed="safe"]){filter:blur(20px)!important;}',
    ),
  queueImages: (...args: unknown[]) => mockQueueImages(...args),
  observeImagesForViewport: (...args: unknown[]) => mockObserveImagesForViewport(...args),
}));

// Mock nsfw-detector (transitive dependency)
jest.mock('../../src/shared/nsfw-detector', () => ({
  classifyImage: jest.fn().mockResolvedValue({ isNSFW: false, score: 0.1 }),
  isModelReady: jest.fn().mockReturnValue(true),
  loadModel: jest.fn().mockResolvedValue(undefined),
}));

describe('shadow-dom-scanner', () => {
  beforeEach(() => {
    mockQueueImages.mockClear();
    mockObserveImagesForViewport.mockClear();
    document.body.innerHTML = '';
    stopShadowDomScanner();
  });

  afterEach(() => {
    stopShadowDomScanner();
  });

  it('starts and stops without errors', () => {
    expect(() => startShadowDomScanner()).not.toThrow();
    expect(() => stopShadowDomScanner()).not.toThrow();
  });

  it('is idempotent — calling start twice does not throw', () => {
    startShadowDomScanner();
    expect(() => startShadowDomScanner()).not.toThrow();
  });

  it('stop is safe to call without start', () => {
    expect(() => stopShadowDomScanner()).not.toThrow();
  });

  it('scans images inside an existing open shadow root', () => {
    // Create a host element with an open shadow root containing an image
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    shadow.appendChild(img);

    startShadowDomScanner();

    expect(mockQueueImages).toHaveBeenCalledWith([img]);
    expect(mockObserveImagesForViewport).toHaveBeenCalledWith([img]);
  });

  it('does not scan shadow roots with no images', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(document.createElement('span'));

    startShadowDomScanner();

    expect(mockQueueImages).not.toHaveBeenCalled();
  });

  it('does not crash if no shadow roots exist', () => {
    document.body.innerHTML = '<div><img src="test.jpg"></div>';
    expect(() => startShadowDomScanner()).not.toThrow();
    // Should not queue images from the main DOM (only shadow roots)
    expect(mockQueueImages).not.toHaveBeenCalled();
  });

  it('falls back to style element when adoptedStyleSheets fails', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    // Make adoptedStyleSheets throw by making the property setter throw
    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      get: () => {
        throw new Error('adoptedStyleSheets not supported');
      },
      set: () => {
        throw new Error('adoptedStyleSheets not supported');
      },
      configurable: true,
    });

    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    shadow.appendChild(img);

    // Should not throw — falls back to <style> element
    expect(() => startShadowDomScanner()).not.toThrow();

    // Verify fallback style element was injected
    const styleEl = shadow.querySelector('style');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.textContent).toContain('blur(20px)');

    // Images should still be scanned
    expect(mockQueueImages).toHaveBeenCalledWith([img]);
  });

  it('MutationObserver inside shadow root detects new images', (done) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    startShadowDomScanner();
    mockQueueImages.mockClear();
    mockObserveImagesForViewport.mockClear();

    // Add a new image to the shadow root after scanner started
    setTimeout(() => {
      const img = document.createElement('img');
      img.src = 'https://example.com/dynamic.jpg';
      shadow.appendChild(img);
    }, 10);

    setTimeout(() => {
      expect(mockQueueImages).toHaveBeenCalledWith([expect.any(HTMLImageElement)]);
      expect(mockObserveImagesForViewport).toHaveBeenCalledWith([expect.any(HTMLImageElement)]);
      done();
    }, 200);
  }, 5000);

  it('MutationObserver inside shadow root detects nested elements containing images', (done) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    startShadowDomScanner();
    mockQueueImages.mockClear();
    mockObserveImagesForViewport.mockClear();

    // Add a container with images inside
    setTimeout(() => {
      const div = document.createElement('div');
      const img1 = document.createElement('img');
      img1.src = 'https://example.com/nested1.jpg';
      const img2 = document.createElement('img');
      img2.src = 'https://example.com/nested2.jpg';
      div.appendChild(img1);
      div.appendChild(img2);
      shadow.appendChild(div);
    }, 10);

    setTimeout(() => {
      expect(mockQueueImages).toHaveBeenCalled();
      // The call should include the nested images
      const calledWith = mockQueueImages.mock.calls[0][0] as HTMLImageElement[];
      expect(calledWith.length).toBe(2);
      done();
    }, 200);
  }, 5000);

  it('checkForShadowRoots finds child elements with shadow roots during initial scan', () => {
    // Create a parent element with a child that has its own shadow root
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const child = document.createElement('div');
    parent.appendChild(child);
    const shadow = child.attachShadow({ mode: 'open' });

    const img = document.createElement('img');
    img.src = 'https://example.com/child-shadow.jpg';
    shadow.appendChild(img);

    startShadowDomScanner();

    // The scanner should find the shadow root on the child and scan its images
    expect(mockQueueImages).toHaveBeenCalledWith([img]);
  });

  it('body observer detects new elements with shadow roots', (done) => {
    startShadowDomScanner();
    mockQueueImages.mockClear();
    mockObserveImagesForViewport.mockClear();

    setTimeout(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const img = document.createElement('img');
      img.src = 'https://example.com/new-shadow.jpg';
      shadow.appendChild(img);
    }, 10);

    setTimeout(() => {
      expect(mockQueueImages).toHaveBeenCalledWith([expect.any(HTMLImageElement)]);
      done();
    }, 200);
  }, 5000);

  it('does not register the same shadow root twice', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    shadow.appendChild(img);

    startShadowDomScanner();

    const firstCallCount = mockQueueImages.mock.calls.length;
    expect(firstCallCount).toBe(1);

    // Stop and start again — shadow root should not be re-registered
    // because the registeredRoots WeakSet persists within the module
    stopShadowDomScanner();
    startShadowDomScanner();

    // After restart the scanner re-scans existing elements, but the
    // WeakSet was cleared when the module re-checks. Actually
    // stopShadowDomScanner does NOT clear the registeredRoots WeakSet,
    // so the same shadow root won't be processed again.
    // The queueImages call count should remain at 1 (no new call).
    expect(mockQueueImages.mock.calls.length).toBe(firstCallCount);
  });
});
