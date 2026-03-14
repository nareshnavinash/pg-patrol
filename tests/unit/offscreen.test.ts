/**
 * Tests for the offscreen document ML inference handler.
 * Mocks @huggingface/transformers pipeline and chrome.runtime messaging.
 */

// Mock the @huggingface/transformers module before importing offscreen
const mockPipeline = jest.fn();
const mockEnv = {
  allowRemoteModels: true,
  localModelPath: '',
  backends: {
    onnx: {
      wasm: {
        wasmPaths: '',
      },
    },
  },
};

jest.mock('@huggingface/transformers', () => ({
  pipeline: mockPipeline,
  env: mockEnv,
}));

const mockNsfwRun = jest.fn().mockResolvedValue({
  output: { data: new Float32Array([6.0, -4.0]) },
});
const mockNsfwCreate = jest.fn().mockResolvedValue({
  inputNames: ['input'],
  outputNames: ['output'],
  run: mockNsfwRun,
});
const mockTensor = jest.fn().mockImplementation((type: string, data: Float32Array, dims: number[]) => ({
  type,
  data,
  dims,
}));

jest.mock('onnxruntime-web', () => ({
  env: {
    wasm: { wasmPaths: '' },
  },
  InferenceSession: {
    create: (...args: unknown[]) => mockNsfwCreate(...args),
  },
  Tensor: (...args: unknown[]) => mockTensor(...args),
}));

describe('offscreen ML inference', () => {
  const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
  const mockAddListener = chrome.runtime.onMessage.addListener as jest.Mock;
  let messageHandler: (message: any, sender: any, sendResponse: any) => void;

  // Mock classifier that returns configurable results
  const mockClassifier = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockSendMessage.mockReset();
    // Ensure sendMessage always returns a Promise (offscreen code calls .catch() on it)
    mockSendMessage.mockReturnValue(Promise.resolve());
    mockAddListener.mockReset();
    mockClassifier.mockReset();

    // Default: pipeline returns our mock classifier
    mockPipeline.mockReset();
    mockPipeline.mockResolvedValue(mockClassifier);
    mockNsfwRun.mockClear();
    mockNsfwCreate.mockClear();
    mockTensor.mockClear();

    // Default multi-label result (non-toxic)
    mockClassifier.mockResolvedValue([
      { label: 'toxic', score: 0.05 },
      { label: 'severe_toxic', score: 0.01 },
      { label: 'obscene', score: 0.03 },
      { label: 'threat', score: 0.01 },
      { label: 'insult', score: 0.04 },
      { label: 'identity_hate', score: 0.01 },
    ]);

    // Import the offscreen module to register the message listener
    require('../../src/ml-inference/offscreen');

    // Capture the registered message listener
    const calls = mockAddListener.mock.calls;
    messageHandler = calls[calls.length - 1][0];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configures Transformers.js env for local model loading', () => {
    expect(mockEnv.allowRemoteModels).toBe(false);
    expect(mockEnv.localModelPath).toContain('assets/ml-models/');
    // WASM paths are set conditionally if env.backends.onnx.wasm exists
    if (mockEnv.backends?.onnx?.wasm) {
      expect(mockEnv.backends.onnx.wasm.wasmPaths).toContain('assets/ml-models/wasm/');
    }
  });

  it('initializes pipeline with correct model and options', async () => {
    // Send a classify request to trigger pipeline initialization
    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'test', requestId: 1 } },
      {},
      jest.fn(),
    );

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPipeline).toHaveBeenCalledWith(
      'text-classification',
      'minuva/MiniLMv2-toxic-jigsaw-onnx',
      { local_files_only: true, device: 'wasm' },
    );
  });

  it('responds with toxic result when toxic score > 0.5', async () => {
    mockClassifier.mockResolvedValue([
      { label: 'toxic', score: 0.92 },
      { label: 'severe_toxic', score: 0.6 },
      { label: 'obscene', score: 0.7 },
      { label: 'threat', score: 0.1 },
      { label: 'insult', score: 0.8 },
      { label: 'identity_hate', score: 0.05 },
    ]);

    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'you are worthless scum', requestId: 42 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 42,
        result: { isToxic: true, confidence: 0.92 },
      },
    });
  });

  it('responds with non-toxic result when toxic score ≤ 0.5', async () => {
    mockClassifier.mockResolvedValue([
      { label: 'toxic', score: 0.12 },
      { label: 'severe_toxic', score: 0.01 },
      { label: 'obscene', score: 0.05 },
      { label: 'threat', score: 0.01 },
      { label: 'insult', score: 0.08 },
      { label: 'identity_hate', score: 0.01 },
    ]);

    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'hello world', requestId: 7 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 7,
        result: { isToxic: false, confidence: 0.12 },
      },
    });
  });

  it('passes text to the classifier with topk: null', async () => {
    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'classify this text', requestId: 3 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockClassifier).toHaveBeenCalledWith('classify this text', { topk: null });
  });

  it('responds with safe fallback when classifier throws', async () => {
    mockClassifier.mockRejectedValue(new Error('Inference failed'));

    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'some text', requestId: 99 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 99,
        result: { isToxic: false, confidence: 0 },
      },
    });
  });

  it('responds with safe fallback when pipeline initialization fails', async () => {
    // Reset modules to get a fresh pipeline attempt
    jest.resetModules();
    mockPipeline.mockReset();
    mockPipeline.mockRejectedValue(new Error('Model not found'));
    mockAddListener.mockReset();
    mockSendMessage.mockReset();
    mockSendMessage.mockReturnValue(Promise.resolve());

    require('../../src/ml-inference/offscreen');
    const calls = mockAddListener.mock.calls;
    const handler = calls[calls.length - 1][0];

    handler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'text', requestId: 55 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 55,
        result: { isToxic: false, confidence: 0 },
      },
    });
  });

  it('ignores non ML_CLASSIFY_INTERNAL messages', async () => {
    messageHandler(
      { type: 'UPDATE_STATS', data: {} },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    // Should not call the classifier
    expect(mockClassifier).not.toHaveBeenCalled();
  });

  it('preserves requestId through the response', async () => {
    const requestIds = [1, 2, 3];

    for (const id of requestIds) {
      messageHandler(
        { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'text', requestId: id } },
        {},
        jest.fn(),
      );
    }

    await new Promise((r) => setTimeout(r, 100));

    const responseCalls = mockSendMessage.mock.calls.filter(
      (call: any[]) => call[0].type === 'ML_CLASSIFY_RESPONSE',
    );

    const returnedIds = responseCalls.map((call: any[]) => call[0].data.requestId);
    expect(returnedIds).toEqual(expect.arrayContaining(requestIds));
  });

  it('reuses the classifier instance across requests (pipeline called once)', async () => {
    // First request triggers pipeline initialization
    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'first', requestId: 1 } },
      {},
      jest.fn(),
    );
    await new Promise((r) => setTimeout(r, 100));

    // Second request should reuse the cached classifier
    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'second', requestId: 2 } },
      {},
      jest.fn(),
    );
    await new Promise((r) => setTimeout(r, 100));

    // Pipeline() is called once per module load in beforeEach.
    // Within this test, only the first classify request triggers getClassifier().
    // The second request reuses the cached instance.
    // So classifier should be called exactly twice.
    expect(mockClassifier).toHaveBeenCalledTimes(2);
    expect(mockClassifier).toHaveBeenNthCalledWith(1, 'first', { topk: null });
    expect(mockClassifier).toHaveBeenNthCalledWith(2, 'second', { topk: null });
  });

  it('handles boundary toxic score exactly at 0.5 as non-toxic', async () => {
    mockClassifier.mockResolvedValue([
      { label: 'toxic', score: 0.5 },
      { label: 'severe_toxic', score: 0.1 },
      { label: 'obscene', score: 0.1 },
      { label: 'threat', score: 0.05 },
      { label: 'insult', score: 0.1 },
      { label: 'identity_hate', score: 0.05 },
    ]);

    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'borderline', requestId: 10 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 10,
        result: { isToxic: false, confidence: 0.5 },
      },
    });
  });

  it('handles toxic score just above 0.5 as toxic', async () => {
    mockClassifier.mockResolvedValue([
      { label: 'toxic', score: 0.51 },
      { label: 'severe_toxic', score: 0.1 },
      { label: 'obscene', score: 0.1 },
      { label: 'threat', score: 0.05 },
      { label: 'insult', score: 0.2 },
      { label: 'identity_hate', score: 0.05 },
    ]);

    messageHandler(
      { type: 'ML_CLASSIFY_INTERNAL', data: { text: 'slightly toxic', requestId: 11 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'ML_CLASSIFY_RESPONSE',
      data: {
        requestId: 11,
        result: { isToxic: true, confidence: 0.51 },
      },
    });
  });

  it('warms the NSFW model on NSFW_WARMUP_INTERNAL', async () => {
    messageHandler(
      { type: 'NSFW_WARMUP_INTERNAL', data: { requestId: 77 } },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockNsfwCreate).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'NSFW_WARMUP_RESPONSE',
      data: { requestId: 77, ok: true },
    });
  });

  it('classifies pixel payloads for NSFW_CLASSIFY_INTERNAL', async () => {
    const pixels = new Uint8ClampedArray(384 * 384 * 4).fill(180);

    messageHandler(
      {
        type: 'NSFW_CLASSIFY_INTERNAL',
        data: {
          source: { kind: 'pixels', width: 384, height: 384, data: pixels },
          sensitivity: 'moderate',
          requestId: 88,
          customThreshold: null,
        },
      },
      {},
      jest.fn(),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'NSFW_CLASSIFY_RESPONSE',
      data: {
        requestId: 88,
        result: { isNSFW: true, score: expect.any(Number) },
      },
    });
  });
});
