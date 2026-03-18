/**
 * Shared ML inference engine for text toxicity and NSFW image classification.
 * Used by both:
 *   - Chrome: offscreen document (offscreen.ts)
 *   - Firefox: background page (index.firefox.ts) — no offscreen API available
 *
 * The engine is instantiated with a config that provides browser-specific
 * asset URL resolution and idle notification.
 */

import { pipeline, env } from '@huggingface/transformers';
import {
  MODEL_INPUT_SIZE,
  softmax,
  preprocessImageData,
  centerCropParams,
} from '../shared/nsfw-preprocessing';
import type { NSFWImageInput } from '../shared/types';

// ---- Public types ----

export interface InferenceEngineConfig {
  /** Resolve a relative asset path to a full URL (e.g. chrome.runtime.getURL). */
  getAssetURL: (relativePath: string) => string;
  /** Called when all models have been idle for 5 minutes. */
  onIdle: () => void;
}

export interface MLClassifyResult {
  isToxic: boolean;
  confidence: number;
}

export interface InferenceEngine {
  classifyText(text: string): Promise<MLClassifyResult>;
  warmupNSFW(): Promise<void>;
  classifyImage(
    source: NSFWImageInput,
    sensitivity: string,
    customThreshold?: number | null,
  ): Promise<{ isNSFW: boolean; score: number }>;
  resetIdleTimer(): void;
  dispose(): void;
}

// ---- Factory ----

export function createInferenceEngine(config: InferenceEngineConfig): InferenceEngine {
  // Configure Transformers.js for local-only model loading
  env.allowRemoteModels = false;
  env.localModelPath = config.getAssetURL('assets/ml-models/');
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = config.getAssetURL('assets/ml-models/wasm/');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let classifier: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let classifierPromise: Promise<any> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  type OrtInferenceSession = import('onnxruntime-web').InferenceSession;
  let nsfwSession: OrtInferenceSession | null = null;
  let nsfwSessionPromise: Promise<void> | null = null;

  // 2.5: Reusable OffscreenCanvas — avoids allocation/GC per classification
  let sharedCanvas: OffscreenCanvas | null = null;
  let sharedCtx: OffscreenCanvasRenderingContext2D | null = null;

  function getSharedCanvas(): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
    if (!sharedCanvas || !sharedCtx) {
      sharedCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true })!;
    }
    return { canvas: sharedCanvas, ctx: sharedCtx };
  }

  /**
   * Sensitivity thresholds — must match nsfw-detector.ts
   */
  const NSFW_THRESHOLDS: Record<string, number> = {
    mild: 0.85,
    moderate: 0.6,
    strict: 0.3,
  };

  // Ambiguous score range — images in this range get a second zoomed-in pass
  const AMBIGUOUS_LOW = 0.2;
  const AMBIGUOUS_HIGH = 0.7;

  // ---- Lifecycle ----

  function resetIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      dispose();
      config.onIdle();
    }, IDLE_TIMEOUT);
  }

  function dispose(): void {
    nsfwSession?.release?.();
    nsfwSession = null;
    nsfwSessionPromise = null;
    classifier?.dispose?.();
    classifier = null;
    classifierPromise = null;
    sharedCanvas = null;
    sharedCtx = null;
  }

  // ---- Text classification (Transformers.js) ----

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getClassifier(): Promise<any> {
    if (classifier) {
      resetIdleTimer();
      return classifier;
    }

    if (!classifierPromise) {
      classifierPromise = pipeline('text-classification', 'minuva/MiniLMv2-toxic-jigsaw-onnx', {
        local_files_only: true,
        device: 'wasm',
      })
        .then((clf) => {
          classifier = clf;
          resetIdleTimer();
          return classifier;
        })
        .catch((err) => {
          classifierPromise = null;
          throw err;
        });
    }

    return classifierPromise;
  }

  async function classifyText(text: string): Promise<MLClassifyResult> {
    const clf = await getClassifier();

    // Multi-label model: get all 6 Jigsaw toxicity labels
    const results = await clf(text, { topk: null });

    // Find the "toxic" label score (general toxicity indicator)
    // Model labels: toxic, severe_toxic, obscene, threat, insult, identity_hate
    let toxicScore = 0;
    if (Array.isArray(results)) {
      for (const r of results as Array<{ label: string; score: number }>) {
        if (r.label === 'toxic') {
          toxicScore = r.score;
          break;
        }
      }
    }

    return { isToxic: toxicScore > 0.5, confidence: toxicScore };
  }

  // ---- NSFW image classification (ONNX Runtime) ----

  async function ensureNsfwModel(): Promise<void> {
    if (nsfwSession) return;
    if (nsfwSessionPromise) return nsfwSessionPromise;

    nsfwSessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = config.getAssetURL('assets/models/');
      const modelPath = config.getAssetURL('assets/models/nsfw.onnx');
      nsfwSession = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
    })();

    return nsfwSessionPromise;
  }

  /**
   * Run a single inference pass on prepared ImageData and return the NSFW probability.
   */
  async function runInference(imageData: ImageData): Promise<number> {
    const float32Data = preprocessImageData(imageData);

    await ensureNsfwModel();
    const ort = await import('onnxruntime-web');
    const inputTensor = new ort.Tensor('float32', float32Data, [
      1,
      3,
      MODEL_INPUT_SIZE,
      MODEL_INPUT_SIZE,
    ]);
    const feeds: Record<string, import('onnxruntime-web').Tensor> = {};
    feeds[nsfwSession!.inputNames[0]] = inputTensor;

    const results = await nsfwSession!.run(feeds);
    const outputTensor = results[nsfwSession!.outputNames[0]];
    const outputData = outputTensor.data as Float32Array;
    const [nsfwProb] = softmax(outputData);
    inputTensor.dispose();
    outputTensor.dispose?.();
    return nsfwProb;
  }

  /**
   * Create a zoomed center-crop (2x zoom: takes the center 50% of the image).
   */
  function getZoomedImageDataFromBitmap(bitmap: ImageBitmap): ImageData {
    const cropW = Math.floor(bitmap.width / 2);
    const cropH = Math.floor(bitmap.height / 2);
    const sx = Math.floor((bitmap.width - cropW) / 2);
    const sy = Math.floor((bitmap.height - cropH) / 2);
    const { sx: cx, sy: cy, sSize } = centerCropParams(cropW, cropH);

    const { ctx } = getSharedCanvas();
    ctx.clearRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    ctx.drawImage(bitmap, sx + cx, sy + cy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    return ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  }

  async function classifyImage(
    source: NSFWImageInput,
    sensitivity: string,
    customThreshold?: number | null,
  ): Promise<{ isNSFW: boolean; score: number }> {
    resetIdleTimer();

    // For URL sources, fetch the bitmap once and reuse for both passes
    let bitmap: ImageBitmap | null = null;
    let imageData: ImageData;

    if (source.kind === 'url') {
      const response = await fetch(source.imageUrl);
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob);
      const { sx, sy, sSize } = centerCropParams(bitmap.width, bitmap.height);
      const { ctx } = getSharedCanvas();
      ctx.clearRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    } else {
      imageData = {
        data: source.data,
        width: source.width,
        height: source.height,
      } as ImageData;
    }

    let nsfwProb = await runInference(imageData);

    // Multi-crop: for ambiguous scores, run a second pass with 2x center zoom
    if (nsfwProb >= AMBIGUOUS_LOW && nsfwProb <= AMBIGUOUS_HIGH && bitmap) {
      const zoomedData = getZoomedImageDataFromBitmap(bitmap);
      const zoomedProb = await runInference(zoomedData);
      nsfwProb = Math.max(nsfwProb, zoomedProb);
    }

    bitmap?.close();

    const threshold = customThreshold ?? NSFW_THRESHOLDS[sensitivity] ?? 0.6;
    return { isNSFW: nsfwProb >= threshold, score: nsfwProb };
  }

  async function warmupNSFW(): Promise<void> {
    resetIdleTimer();
    await ensureNsfwModel();
  }

  return {
    classifyText,
    warmupNSFW,
    classifyImage,
    resetIdleTimer,
    dispose,
  };
}
