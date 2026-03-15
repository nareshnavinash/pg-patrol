/**
 * Tests for the NSFW detector messaging layer.
 */

const mockPixelData = new Uint8ClampedArray(384 * 384 * 4).fill(128);
const mockCanvasContext = {
  drawImage: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn().mockReturnValue({ data: mockPixelData }),
};

HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(
  mockCanvasContext,
) as unknown as typeof HTMLCanvasElement.prototype.getContext;

import {
  classifyImage,
  classifyImageUrl,
  loadModel,
  isModelReady,
  isModelLoading,
  unloadModel,
  preprocessImage,
  softmax,
  MODEL_INPUT_SIZE,
} from '../../src/shared/nsfw-detector';

import { centerCropParams } from '../../src/shared/nsfw-preprocessing';

function createMockImage(src: string, naturalWidth = 100, naturalHeight = 100): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'src', { value: src, configurable: true });
  Object.defineProperty(img, 'currentSrc', { value: src, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

describe('nsfw-detector', () => {
  const sendMessage = chrome.runtime.sendMessage as jest.Mock;

  beforeEach(() => {
    unloadModel();
    mockCanvasContext.drawImage.mockClear();
    mockCanvasContext.getImageData.mockReset();
    mockCanvasContext.getImageData.mockReturnValue({ data: mockPixelData });
    sendMessage.mockReset();
    (chrome.runtime as any).lastError = null;
  });

  afterEach(() => {
    (chrome.runtime as any).lastError = null;
  });

  it('warms the offscreen model once', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: { ok: boolean }) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
      }
    });

    await loadModel();
    await loadModel();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      { type: 'NSFW_WARMUP' },
      expect.any(Function),
    );
    expect(isModelReady()).toBe(true);
  });

  it('tracks loading state during warmup', async () => {
    let resolveWarmup: ((value: { ok: boolean }) => void) | null = null;
    sendMessage.mockImplementation((message: any, callback: (response: { ok: boolean }) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        resolveWarmup = callback;
      }
    });

    const loadPromise = loadModel();
    expect(isModelLoading()).toBe(true);
    resolveWarmup?.({ ok: true });
    await loadPromise;
    expect(isModelLoading()).toBe(false);
  });

  it('classifies normal web images by URL through the offscreen document', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: any) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
        return;
      }
      if (message.type === 'NSFW_CLASSIFY_IMAGE') {
        callback({ isNSFW: false, score: 0.12 });
      }
    });

    const result = await classifyImage(createMockImage('https://example.com/photo.jpg'), 'moderate');

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'NSFW_CLASSIFY_IMAGE',
        data: {
          source: { kind: 'url', imageUrl: 'https://example.com/photo.jpg' },
          sensitivity: 'moderate',
          customThreshold: undefined,
        },
      },
      expect.any(Function),
    );
    expect(result.isNSFW).toBe(false);
    expect(result.score).toBeCloseTo(0.12, 2);
    expect(result.topClass).toBe('Neutral');
  });

  it('classifies blob images by sending pixel payloads', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: any) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
        return;
      }
      if (message.type === 'NSFW_CLASSIFY_IMAGE') {
        callback({ isNSFW: true, score: 0.91 });
      }
    });

    const result = await classifyImage(createMockImage('blob:https://example.com/abc'), 'strict');

    const classifyCall = sendMessage.mock.calls.find(
      ([message]) => message.type === 'NSFW_CLASSIFY_IMAGE',
    );
    expect(classifyCall?.[0].data.source.kind).toBe('pixels');
    expect(classifyCall?.[0].data.source.width).toBe(MODEL_INPUT_SIZE);
    expect(classifyCall?.[0].data.source.height).toBe(MODEL_INPUT_SIZE);
    expect(classifyCall?.[0].data.source.data).toBeInstanceOf(Uint8ClampedArray);
    expect(result.isNSFW).toBe(true);
    expect(result.score).toBeCloseTo(0.91, 2);
  });

  it('classifyImageUrl forwards URL inputs directly', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: any) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
        return;
      }
      if (message.type === 'NSFW_CLASSIFY_IMAGE') {
        callback({ isNSFW: true, score: 0.77 });
      }
    });

    const result = await classifyImageUrl('https://pbs.twimg.com/media/test.jpg', 'strict', 0.5);

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'NSFW_CLASSIFY_IMAGE',
        data: {
          source: { kind: 'url', imageUrl: 'https://pbs.twimg.com/media/test.jpg' },
          sensitivity: 'strict',
          customThreshold: 0.5,
        },
      },
      expect.any(Function),
    );
    expect(result.isNSFW).toBe(true);
    expect(result.score).toBeCloseTo(0.77, 2);
  });

  it('fails safe when offscreen messaging errors', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: any) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
        return;
      }
      if (message.type === 'NSFW_CLASSIFY_IMAGE') {
        (chrome.runtime as any).lastError = { message: 'Connection failed' };
        callback(undefined);
      }
    });

    const result = await classifyImage(createMockImage('https://example.com/error.jpg'), 'moderate');

    expect(result.isNSFW).toBe(true);
    expect(result.score).toBe(1);
  });

  it('resetting the detector clears readiness state', async () => {
    sendMessage.mockImplementation((message: any, callback: (response: { ok: boolean }) => void) => {
      if (message.type === 'NSFW_WARMUP') {
        callback({ ok: true });
      }
    });

    await loadModel();
    expect(isModelReady()).toBe(true);
    unloadModel();
    expect(isModelReady()).toBe(false);
  });

  it('preprocessImage returns normalized Float32 input', () => {
    const result = preprocessImage(createMockImage('blob:https://example.com/local'));
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  });

  it('softmax converts logits to probabilities', () => {
    const result = softmax(new Float32Array([0, 0]));
    expect(result[0]).toBeCloseTo(0.5, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
  });

  describe('centerCropParams', () => {
    it('returns full image for a square image', () => {
      const { sx, sy, sSize } = centerCropParams(400, 400);
      expect(sx).toBe(0);
      expect(sy).toBe(0);
      expect(sSize).toBe(400);
    });

    it('crops horizontally for a wide landscape image', () => {
      const { sx, sy, sSize } = centerCropParams(1920, 1080);
      expect(sSize).toBe(1080);
      expect(sx).toBe(420); // (1920 - 1080) / 2
      expect(sy).toBe(0);
    });

    it('crops vertically for a tall portrait image', () => {
      const { sx, sy, sSize } = centerCropParams(1080, 1920);
      expect(sSize).toBe(1080);
      expect(sx).toBe(0);
      expect(sy).toBe(420); // (1920 - 1080) / 2
    });
  });

  it('preprocessImage uses center-crop drawImage for non-square images', () => {
    const img = createMockImage('blob:https://example.com/wide', 1920, 1080);

    preprocessImage(img);

    // Should use the 9-arg drawImage (center-crop), not the stretch version
    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(1);
    const args = mockCanvasContext.drawImage.mock.calls[0];
    // 9-arg form: drawImage(src, sx, sy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
    expect(args).toHaveLength(9);
    expect(args[1]).toBe(420);  // sx = (1920 - 1080) / 2
    expect(args[2]).toBe(0);    // sy
    expect(args[3]).toBe(1080); // sSize
    expect(args[4]).toBe(1080); // sSize
    expect(args[5]).toBe(0);    // dx
    expect(args[6]).toBe(0);    // dy
    expect(args[7]).toBe(MODEL_INPUT_SIZE); // dw
    expect(args[8]).toBe(MODEL_INPUT_SIZE); // dh
  });
});
