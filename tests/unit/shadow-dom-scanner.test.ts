/**
 * @jest-environment jsdom
 */

import { startShadowDomScanner, stopShadowDomScanner } from '../../src/content/shadow-dom-scanner';

// Mock image-scanner exports
const mockQueueImages = jest.fn();
const mockObserveImagesForViewport = jest.fn();

jest.mock('../../src/content/image-scanner', () => ({
  getNsfwStyleSheetCssText: jest.fn().mockReturnValue(
    'img:not([data-pg-patrol-img-processed="safe"]){filter:blur(20px)!important;}'
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
});
