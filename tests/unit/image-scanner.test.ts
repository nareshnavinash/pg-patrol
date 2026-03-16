/**
 * @jest-environment jsdom
 */

import {
  setSensitivity,
  getReplacedImageCount,
  queueImages,
  requeueImage,
  queueVideoElements,
  queueBackgroundImages,
  shouldScanVideo,
  isVideoThumbnailBg,
  shouldScanBgImage,
  extractBgImageUrl,
  collectVideoThumbnails,
  collectBackgroundThumbnails,
  ensureNsfwStyleSheet,
  getNsfwStyleSheetCssText,
  initImageCache,
  imageCache,
  setDeveloperMode,
  onScanProgress,
} from '../../src/content/image-scanner';

// Mock nsfw-detector to avoid loading ONNX in tests
const mockClassifyImage = jest.fn().mockResolvedValue({
  isNSFW: false,
  score: 0.1,
  predictions: [],
  topClass: 'Neutral',
});

jest.mock('../../src/shared/nsfw-detector', () => ({
  classifyImage: (...args: unknown[]) => mockClassifyImage(...args),
  classifyImageUrl: (...args: unknown[]) => mockClassifyImage(...args),
  isModelReady: jest.fn().mockReturnValue(true),
  loadModel: jest.fn().mockResolvedValue(undefined),
  THRESHOLDS: { mild: 0.85, moderate: 0.6, strict: 0.3 },
}));

// Mock observer to avoid importing the full observer module
jest.mock('../../src/content/observer', () => ({
  pauseObserver: jest.fn(),
  resumeObserver: jest.fn(),
  startObserver: jest.fn(),
  stopObserver: jest.fn(),
}));

// Provide chrome.storage.local stub for cache
if (!(globalThis as Record<string, unknown>).chrome) {
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: jest.fn(async () => ({})),
        set: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
      },
    },
  };
}

const OVERLAY_ROOT_ID = 'pg-patrol-media-overlay-root';

describe('image-scanner', () => {
  function createScannableImage(src = 'https://example.com/photo.jpg'): HTMLImageElement {
    const img = document.createElement('img');
    let currentSrc = src;
    img.setAttribute('src', src);
    Object.defineProperty(img, 'src', {
      configurable: true,
      get: () => currentSrc,
      set: (value: string) => {
        currentSrc = value;
        img.setAttribute('src', value);
      },
    });
    Object.defineProperty(img, 'currentSrc', {
      configurable: true,
      get: () => currentSrc,
      set: (value: string) => {
        currentSrc = value;
      },
    });
    Object.defineProperty(img, 'complete', { value: true, configurable: true, writable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true, writable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 400, configurable: true, writable: true });
    img.decode = jest.fn().mockResolvedValue(undefined);
    return img;
  }

  async function flushAsyncWork(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  }

  beforeEach(() => {
    mockClassifyImage.mockReset();
    mockClassifyImage.mockResolvedValue({
      isNSFW: false,
      score: 0.1,
      predictions: [],
      topClass: 'Neutral',
    });
    document.body.innerHTML = '';
  });

  describe('setSensitivity', () => {
    it('accepts sensitivity levels without errors', () => {
      expect(() => setSensitivity('mild')).not.toThrow();
      expect(() => setSensitivity('moderate')).not.toThrow();
      expect(() => setSensitivity('strict')).not.toThrow();
    });
  });

  describe('getReplacedImageCount', () => {
    it('starts at 0', () => {
      expect(getReplacedImageCount()).toBe(0);
    });
  });

  describe('queueImages', () => {
    it('does not classify the same image twice when queued repeatedly', async () => {
      const img = createScannableImage();

      queueImages([img]);
      queueImages([img]);
      await flushAsyncWork();

      expect(mockClassifyImage).toHaveBeenCalledTimes(1);
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
    });

    it('marks missing-src images as pending and retries after src change', async () => {
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false, configurable: true });

      queueImages([img]);
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('pending');

      Object.defineProperty(img, 'src', {
        value: 'https://example.com/lazy.jpg',
        configurable: true,
        writable: true,
      });
      Object.defineProperty(img, 'currentSrc', {
        value: 'https://example.com/lazy.jpg',
        configurable: true,
        writable: true,
      });
      Object.defineProperty(img, 'complete', { value: true, configurable: true });
      Object.defineProperty(img, 'naturalWidth', { value: 300, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
      img.decode = jest.fn().mockResolvedValue(undefined);

      requeueImage(img);
      await flushAsyncWork();

      expect(mockClassifyImage).toHaveBeenCalledTimes(1);
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
    });

    it('keeps placeholder-style images pending and blurred until a real src arrives', () => {
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: true, configurable: true });
      Object.defineProperty(img, 'naturalWidth', { value: 300, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
      document.body.appendChild(img);

      queueImages([img]);

      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('pending');
      expect(img.style.opacity).toBe('0');
      expect(document.getElementById(OVERLAY_ROOT_ID)?.textContent).toContain('Checking image');
    });

    it('reprocesses a finalized image when the src changes on the same node', async () => {
      const img = createScannableImage('https://example.com/first.jpg');

      queueImages([img]);
      await flushAsyncWork();
      expect(mockClassifyImage).toHaveBeenCalledTimes(1);
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');

      img.src = 'https://example.com/second.jpg';
      img.currentSrc = 'https://example.com/second.jpg';

      requeueImage(img);
      await flushAsyncWork();

      expect(mockClassifyImage).toHaveBeenCalledTimes(2);
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
    });

    it('replaces NSFW image with a banner element in the DOM', async () => {
      mockClassifyImage.mockResolvedValueOnce({
        isNSFW: true,
        score: 0.95,
        predictions: [],
        topClass: 'Porn',
      });

      const img = createScannableImage('https://example.com/nsfw.jpg');
      document.body.appendChild(img);
      queueImages([img]);
      await flushAsyncWork();

      // Original image should be removed from the DOM
      expect(img.parentNode).toBeNull();

      // Banner should be in the DOM instead
      const banner = document.body.querySelector('img[data-pg-patrol-replaced="true"]');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('data-pg-patrol-overlay-owned')).toBe('true');
      expect(banner!.getAttribute('data-pg-patrol-img-processed')).toBe('nsfw');
      expect(banner!.getAttribute('data-pg-patrol-original-src')).toBe(
        'https://example.com/nsfw.jpg',
      );
      expect((banner as HTMLImageElement).src).toMatch(/^data:image\/svg\+xml/);
    });

    it('skips banner elements in requeueImage', async () => {
      mockClassifyImage.mockResolvedValueOnce({
        isNSFW: true,
        score: 0.95,
        predictions: [],
        topClass: 'Porn',
      });

      const img = createScannableImage('https://example.com/nsfw.jpg');
      document.body.appendChild(img);
      queueImages([img]);
      await flushAsyncWork();

      // The banner is now in the DOM
      const banner = document.body.querySelector(
        'img[data-pg-patrol-replaced="true"]',
      ) as HTMLImageElement;
      expect(banner).not.toBeNull();

      // requeueImage should be a no-op on the banner
      mockClassifyImage.mockClear();
      requeueImage(banner);
      await flushAsyncWork();

      expect(mockClassifyImage).not.toHaveBeenCalled();
    });

    it('allows a new safe image in the same parent after NSFW banner replacement', async () => {
      mockClassifyImage
        .mockResolvedValueOnce({
          isNSFW: true,
          score: 0.95,
          predictions: [],
          topClass: 'Porn',
        })
        .mockResolvedValueOnce({
          isNSFW: false,
          score: 0.04,
          predictions: [],
          topClass: 'Neutral',
        });

      const parent = document.createElement('div');
      document.body.appendChild(parent);

      const nsfwImg = createScannableImage('https://example.com/nsfw-orphan.jpg');
      parent.appendChild(nsfwImg);
      queueImages([nsfwImg]);
      await flushAsyncWork();

      // NSFW img replaced with banner
      const banner = parent.querySelector('img[data-pg-patrol-replaced="true"]');
      expect(banner).not.toBeNull();

      // Remove the banner, add a safe image
      banner!.remove();

      const safeImg = createScannableImage('https://example.com/safe-replacement.jpg');
      parent.appendChild(safeImg);
      queueImages([safeImg]);
      await flushAsyncWork();

      expect(safeImg.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
      expect(safeImg.style.opacity).toBe('');
      expect(safeImg.style.visibility).toBe('');
    });
  });

  describe('banner element guards', () => {
    it('queueImages skips banner elements entirely', async () => {
      const banner = document.createElement('img');
      banner.setAttribute('data-pg-patrol-replaced', 'true');
      banner.setAttribute('data-pg-patrol-overlay-owned', 'true');
      banner.src = 'data:image/svg+xml,<svg></svg>';
      document.body.appendChild(banner);

      mockClassifyImage.mockClear();
      queueImages([banner]);
      await flushAsyncWork();

      expect(mockClassifyImage).not.toHaveBeenCalled();
    });
  });

  // ---- Video poster scanning ----

  describe('shouldScanVideo', () => {
    it('returns true for a video with a poster', () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/thumb.jpg';
      expect(shouldScanVideo(video)).toBe(true);
    });

    it('returns false when video has no poster', () => {
      const video = document.createElement('video');
      expect(shouldScanVideo(video)).toBe(false);
    });

    it('returns false when video has already been processed', () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/thumb.jpg';
      video.setAttribute('data-pg-patrol-vid-processed', 'safe');
      expect(shouldScanVideo(video)).toBe(false);
    });

    it('returns false for SVG posters', () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/poster.svg';
      expect(shouldScanVideo(video)).toBe(false);
    });

    it('returns false for data:image/svg posters', () => {
      const video = document.createElement('video');
      video.poster = 'data:image/svg+xml,<svg></svg>';
      expect(shouldScanVideo(video)).toBe(false);
    });
  });

  describe('collectVideoThumbnails', () => {
    it('finds video elements with poster attributes', () => {
      document.body.innerHTML = `
        <video poster="https://example.com/thumb1.jpg"></video>
        <video poster="https://example.com/thumb2.jpg"></video>
        <video></video>
      `;

      const videos = collectVideoThumbnails();
      expect(videos).toHaveLength(2);
    });

    it('skips already-processed video elements', () => {
      document.body.innerHTML = `
        <video poster="https://example.com/thumb.jpg" data-pg-patrol-vid-processed="safe"></video>
        <video poster="https://example.com/thumb2.jpg"></video>
      `;

      const videos = collectVideoThumbnails();
      expect(videos).toHaveLength(1);
    });

    it('scans within a subtree root', () => {
      document.body.innerHTML = `
        <div id="container">
          <video poster="https://example.com/inner.jpg"></video>
        </div>
        <video poster="https://example.com/outer.jpg"></video>
      `;

      const container = document.getElementById('container')!;
      const videos = collectVideoThumbnails(container);
      expect(videos).toHaveLength(1);
    });

    it('returns empty array when no videos exist', () => {
      document.body.innerHTML = '<div>No videos here</div>';
      expect(collectVideoThumbnails()).toHaveLength(0);
    });
  });

  describe('queueVideoElements', () => {
    it('queues valid video elements for processing', () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/thumb.jpg';

      // Should not throw
      queueVideoElements([video]);
    });

    it('skips videos without posters', () => {
      const video = document.createElement('video');
      // No poster — should be skipped silently
      queueVideoElements([video]);
    });

    it('skips already-processed videos', () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/thumb.jpg';
      video.setAttribute('data-pg-patrol-vid-processed', 'safe');

      queueVideoElements([video]);
    });
  });

  // ---- CSS background-image scanning ----

  describe('extractBgImageUrl', () => {
    it('extracts URL from url("...")', () => {
      expect(extractBgImageUrl('url("https://example.com/img.jpg")')).toBe(
        'https://example.com/img.jpg',
      );
    });

    it("extracts URL from url('...')", () => {
      expect(extractBgImageUrl("url('https://example.com/img.jpg')")).toBe(
        'https://example.com/img.jpg',
      );
    });

    it('extracts URL from url(...) without quotes', () => {
      expect(extractBgImageUrl('url(https://example.com/img.jpg)')).toBe(
        'https://example.com/img.jpg',
      );
    });

    it('returns null for empty string', () => {
      expect(extractBgImageUrl('')).toBeNull();
    });

    it('returns null for "none"', () => {
      expect(extractBgImageUrl('none')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(extractBgImageUrl('linear-gradient(red, blue)')).toBeNull();
    });
  });

  describe('shouldScanBgImage', () => {
    function createSizedDiv(width = 200, height = 200): HTMLDivElement {
      const div = document.createElement('div');
      jest.spyOn(div, 'getBoundingClientRect').mockReturnValue({
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
      return div;
    }

    it('detects any element with a meaningful background-image and sufficient size', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://example.com/banner.jpg")';
      expect(shouldScanBgImage(div)).toBe(true);
    });

    it('detects YouTube thumbnail URLs', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://i.ytimg.com/vi/abc/maxresdefault.jpg")';
      expect(shouldScanBgImage(div)).toBe(true);
    });

    it('detects Vimeo thumbnail URLs', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://i.vimeocdn.com/video/123.jpg")';
      expect(shouldScanBgImage(div)).toBe(true);
    });

    it('detects TikTok thumbnail URLs', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://p16-sign.tiktokcdn.com/obj/abc.jpg")';
      expect(shouldScanBgImage(div)).toBe(true);
    });

    it('returns false for elements without background-image', () => {
      const div = createSizedDiv();
      expect(shouldScanBgImage(div)).toBe(false);
    });

    it('returns false for already-processed elements', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://i.ytimg.com/vi/abc/thumb.jpg")';
      div.setAttribute('data-pg-patrol-bg-processed', 'safe');
      expect(shouldScanBgImage(div)).toBe(false);
    });

    it('returns false for SVG background images', () => {
      const div = createSizedDiv();
      div.style.backgroundImage = 'url("https://example.com/icon.svg")';
      expect(shouldScanBgImage(div)).toBe(false);
    });

    it('returns false for elements below the minimum size', () => {
      const div = createSizedDiv(30, 30);
      div.style.backgroundImage = 'url("https://example.com/tiny.jpg")';
      expect(shouldScanBgImage(div)).toBe(false);
    });

    it('returns false for small data URIs', () => {
      const div = createSizedDiv();
      div.style.backgroundImage =
        'url("data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=")';
      expect(shouldScanBgImage(div)).toBe(false);
    });

    it('isVideoThumbnailBg is an alias for shouldScanBgImage', () => {
      expect(isVideoThumbnailBg).toBe(shouldScanBgImage);
    });
  });

  describe('collectBackgroundThumbnails', () => {
    it('returns empty array when no matching elements exist', () => {
      document.body.innerHTML = '<div>No thumbnails</div>';
      expect(collectBackgroundThumbnails()).toHaveLength(0);
    });

    it('returns empty array when elements have no background-image', () => {
      document.body.innerHTML = '<div class="regular"></div>';
      expect(collectBackgroundThumbnails()).toHaveLength(0);
    });
  });

  describe('queueBackgroundImages', () => {
    it('queues valid background image elements with sufficient size', () => {
      const div = document.createElement('div');
      div.style.backgroundImage = 'url("https://example.com/thumb.jpg")';
      jest.spyOn(div, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Should not throw
      queueBackgroundImages([div]);
    });

    it('skips elements without background images', () => {
      const div = document.createElement('div');
      queueBackgroundImages([div]);
    });
  });

  // ---- Scan-first stylesheet ----

  describe('ensureNsfwStyleSheet', () => {
    it('injects the scan-first stylesheet into the document', () => {
      ensureNsfwStyleSheet();
      const style = document.getElementById('pg-patrol-nsfw-styles');
      expect(style).not.toBeNull();
      expect(style?.tagName).toBe('STYLE');
    });

    it('contains the scan-first blur rule for unclassified images', () => {
      ensureNsfwStyleSheet();
      const style = document.getElementById('pg-patrol-nsfw-styles');
      const css = style?.textContent || '';
      expect(css).toContain('data-pg-patrol-overlay-owned="true"');
      expect(css).toContain('data-pg-patrol-img-processed="safe"');
      expect(css).toContain('data-pg-patrol-img-processed="skipped"');
      expect(css).toContain('opacity:0!important');
    });

    it('contains the raw image hide rule with replaced exemption', () => {
      ensureNsfwStyleSheet();
      const style = document.getElementById('pg-patrol-nsfw-styles');
      const css = style?.textContent || '';
      expect(css).toContain('data-pg-patrol-replaced="true"');
      expect(css).toContain(
        'img:not([data-pg-patrol-overlay-owned="true"]):not([data-pg-patrol-replaced="true"])',
      );
      expect(css).toContain('visibility:hidden!important');
      expect(css).toContain('pointer-events:none!important');
    });

    it('does not contain video hiding rules (videos are not hidden)', () => {
      ensureNsfwStyleSheet();
      const style = document.getElementById('pg-patrol-nsfw-styles');
      const css = style?.textContent || '';
      expect(css).not.toContain('video');
      expect(css).not.toContain('data-pg-patrol-vid-processed');
    });

    it('is idempotent — does not inject duplicate stylesheets', () => {
      ensureNsfwStyleSheet();
      ensureNsfwStyleSheet();
      const styles = document.querySelectorAll('#pg-patrol-nsfw-styles');
      expect(styles).toHaveLength(1);
    });
  });

  describe('getNsfwStyleSheetCssText', () => {
    it('returns CSS text matching the injected stylesheet content', () => {
      const cssText = getNsfwStyleSheetCssText();
      expect(cssText).toContain('data-pg-patrol-overlay-owned="true"');
      expect(cssText).toContain('data-pg-patrol-replaced="true"');
      expect(cssText).toContain('data-pg-patrol-img-processed="safe"');
      expect(cssText).toContain('data-pg-patrol-img-processed="skipped"');
      expect(cssText).toContain('visibility:hidden!important');
    });
  });

  // ---- Persistent cache integration ----

  describe('cache integration', () => {
    it('initImageCache is exported and callable', async () => {
      expect(typeof initImageCache).toBe('function');
      await expect(initImageCache()).resolves.not.toThrow();
    });

    it('imageCache is exported', () => {
      expect(imageCache).toBeDefined();
      expect(typeof imageCache.get).toBe('function');
      expect(typeof imageCache.set).toBe('function');
    });

    it('cached safe image skips classification', async () => {
      const img = createScannableImage('https://example.com/cached-safe.jpg');

      // Pre-populate cache with a safe verdict
      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/cached-safe.jpg', 'safe', 0.05, 200, 'content');

      queueImages([img]);
      await flushAsyncWork();

      // classifyImage should NOT have been called — cache hit
      expect(mockClassifyImage).not.toHaveBeenCalled();
      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
    });

    it('cached NSFW image triggers DOM replacement without classification', async () => {
      const img = createScannableImage('https://example.com/cached-nsfw.jpg');
      document.body.appendChild(img);

      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/cached-nsfw.jpg', 'nsfw', 0.9, 200, 'content');

      queueImages([img]);
      await flushAsyncWork();

      expect(mockClassifyImage).not.toHaveBeenCalled();
      // Original removed, banner inserted
      expect(img.parentNode).toBeNull();
      const banner = document.body.querySelector('img[data-pg-patrol-replaced="true"]');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('data-pg-patrol-img-processed')).toBe('nsfw');
      expect((banner as HTMLImageElement).src).toMatch(/^data:image\/svg\+xml/);
    });

    it('cached NSFW video poster skips classification and shows blocked surface', async () => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/cached-nsfw-poster.jpg';
      document.body.appendChild(video);

      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/cached-nsfw-poster.jpg', 'nsfw', 0.92, 200, 'content');

      queueVideoElements([video]);
      await flushAsyncWork();

      expect(mockClassifyImage).not.toHaveBeenCalled();
      expect(video.getAttribute('data-pg-patrol-vid-processed')).toBe('nsfw');
    });

    it('cached safe background image skips classification', async () => {
      const div = document.createElement('div');
      div.style.backgroundImage = 'url("https://example.com/cached-safe-bg.jpg")';
      jest.spyOn(div, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      document.body.appendChild(div);

      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/cached-safe-bg.jpg', 'safe', 0.05, 200, 'content');

      queueBackgroundImages([div]);
      await flushAsyncWork();

      expect(mockClassifyImage).not.toHaveBeenCalled();
      expect(div.getAttribute('data-pg-patrol-bg-processed')).toBe('safe');
    });

    it('pageNsfwUrls dedup does not inflate replacedCount from persistent cache', async () => {
      const countBefore = getReplacedImageCount();

      // Two images with the same cached NSFW URL — only one should increment
      const img1 = createScannableImage('https://example.com/dedup-nsfw.jpg');
      const img2 = createScannableImage('https://example.com/dedup-nsfw.jpg');
      document.body.appendChild(img1);
      document.body.appendChild(img2);

      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/dedup-nsfw.jpg', 'nsfw', 0.9, 200, 'content');

      queueImages([img1]);
      await flushAsyncWork();
      queueImages([img2]);
      await flushAsyncWork();

      // Only 1 increment despite 2 images with the same URL
      expect(getReplacedImageCount()).toBe(countBefore + 1);
    });

    it('developer mode shows score overlay for cached safe images', async () => {
      setDeveloperMode(true);

      const img = createScannableImage('https://example.com/dev-cached-safe.jpg');
      const parent = document.createElement('div');
      parent.appendChild(img);
      document.body.appendChild(parent);

      imageCache.setThreshold(0.6);
      imageCache.set('https://example.com/dev-cached-safe.jpg', 'safe', 0.1, 200, 'content');

      queueImages([img]);
      await flushAsyncWork();

      expect(img.getAttribute('data-pg-patrol-img-processed')).toBe('safe');
      // Developer mode badge should have been set
      expect(img.getAttribute('data-pg-patrol-debug-badge')).toBe('true');
      // Debug border for safe
      expect(img.style.outline).toContain('#22c55e');

      setDeveloperMode(false);
    });
  });

  describe('onScanProgress callback', () => {
    it('fires with correct processed and total counts', async () => {
      const progressCallback = jest.fn();
      onScanProgress(progressCallback);

      const img = createScannableImage('https://example.com/progress-test.jpg');
      queueImages([img]);
      await flushAsyncWork();

      expect(progressCallback).toHaveBeenCalled();
      // Last call should have processed >= 1
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThanOrEqual(1); // processed
      expect(lastCall[1]).toBeGreaterThanOrEqual(1); // total
    });
  });
});
