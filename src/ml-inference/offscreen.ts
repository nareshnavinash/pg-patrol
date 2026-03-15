/**
 * Offscreen document for ML text classification and NSFW image classification.
 * Runs Transformers.js pipeline in an isolated page context
 * to comply with MV3 CSP restrictions on WASM in service workers.
 *
 * Communication: Background SW sends ML_CLASSIFY_INTERNAL messages,
 * this script processes them and sends ML_CLASSIFY_RESPONSE back.
 * Also handles NSFW_CLASSIFY_IMAGE for cross-origin image classification.
 */

import { pipeline, env } from '@huggingface/transformers';
import {
  MODEL_INPUT_SIZE,
  softmax,
  preprocessImageData,
  centerCropParams,
} from '../shared/nsfw-preprocessing';
import type { NSFWImageInput } from '../shared/types';

// Configure Transformers.js for local-only model loading
env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL('assets/ml-models/');
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/ml-models/wasm/');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifier: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifierPromise: Promise<any> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClassifier(): Promise<any> {
  if (classifier) {
    resetIdleTimer();
    return classifier;
  }

  if (!classifierPromise) {
    classifierPromise = pipeline(
      'text-classification',
      'minuva/MiniLMv2-toxic-jigsaw-onnx',
      { local_files_only: true, device: 'wasm' },
    ).then((clf) => {
      classifier = clf;
      resetIdleTimer();
      return classifier;
    }).catch((err) => {
      classifierPromise = null;
      throw err;
    });
  }

  return classifierPromise;
}

function disposeModels(): void {
  nsfwSession?.release?.();
  nsfwSession = null;
  nsfwSessionPromise = null;
  classifier?.dispose?.();
  classifier = null;
  classifierPromise = null;
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    disposeModels();
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_IDLE' }).catch(() => {});
  }, IDLE_TIMEOUT);
}

// ---- NSFW Image Classification via ONNX ----

type OrtInferenceSession = import('onnxruntime-web').InferenceSession;

let nsfwSession: OrtInferenceSession | null = null;
let nsfwSessionPromise: Promise<void> | null = null;

/**
 * Sensitivity thresholds — must match nsfw-detector.ts
 */
const NSFW_THRESHOLDS: Record<string, number> = {
  mild: 0.85,
  moderate: 0.60,
  strict: 0.30,
};

async function ensureNsfwModel(): Promise<void> {
  if (nsfwSession) return;
  if (nsfwSessionPromise) return nsfwSessionPromise;

  nsfwSessionPromise = (async () => {
    const ort = await import('onnxruntime-web');
    ort.env.wasm.wasmPaths = chrome.runtime.getURL('assets/models/');
    const modelPath = chrome.runtime.getURL('assets/models/nsfw.onnx');
    nsfwSession = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  })();

  return nsfwSessionPromise;
}

async function getImageDataForSource(source: NSFWImageInput): Promise<ImageData> {
  if (source.kind === 'pixels') {
    return {
      data: source.data,
      width: source.width,
      height: source.height,
    } as ImageData;
  }

  const response = await fetch(source.imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // Center-crop: take the largest centered square, then resize to model input size
  const { sx, sy, sSize } = centerCropParams(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  bitmap.close();
  return ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
}

// Ambiguous score range — images in this range get a second zoomed-in pass
const AMBIGUOUS_LOW = 0.20;
const AMBIGUOUS_HIGH = 0.70;

/**
 * Run a single inference pass on prepared ImageData and return the NSFW probability.
 */
async function runInference(imageData: ImageData): Promise<number> {
  const float32Data = preprocessImageData(imageData);

  await ensureNsfwModel();
  const ort = await import('onnxruntime-web');
  const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
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
 * Reuses an already-fetched bitmap to avoid a redundant network request.
 */
function getZoomedImageDataFromBitmap(bitmap: ImageBitmap): ImageData {
  // Take the center 50% of the image (2x zoom)
  const cropW = Math.floor(bitmap.width / 2);
  const cropH = Math.floor(bitmap.height / 2);
  const sx = Math.floor((bitmap.width - cropW) / 2);
  const sy = Math.floor((bitmap.height - cropH) / 2);
  const { sx: cx, sy: cy, sSize } = centerCropParams(cropW, cropH);

  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx + cx, sy + cy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  return ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
}

async function classifyImageInOffscreen(
  source: NSFWImageInput,
  sensitivity: string,
  customThreshold?: number | null,
): Promise<{ isNSFW: boolean; score: number }> {
  // For URL sources, fetch the bitmap once and reuse for both passes
  let bitmap: ImageBitmap | null = null;
  let imageData: ImageData;

  if (source.kind === 'url') {
    const response = await fetch(source.imageUrl);
    const blob = await response.blob();
    bitmap = await createImageBitmap(blob);
    const { sx, sy, sSize } = centerCropParams(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  } else {
    imageData = await getImageDataForSource(source);
  }

  let nsfwProb = await runInference(imageData);

  // Multi-crop: for ambiguous scores, run a second pass with 2x center zoom
  if (nsfwProb >= AMBIGUOUS_LOW && nsfwProb <= AMBIGUOUS_HIGH && bitmap) {
    const zoomedData = getZoomedImageDataFromBitmap(bitmap);
    const zoomedProb = await runInference(zoomedData);
    nsfwProb = Math.max(nsfwProb, zoomedProb);
  }

  bitmap?.close();

  const threshold = customThreshold ?? NSFW_THRESHOLDS[sensitivity] ?? 0.60;
  return { isNSFW: nsfwProb >= threshold, score: nsfwProb };
}

// ---- Message Handling ----

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ML_CLASSIFY_INTERNAL') {
    const { text, requestId } = message.data;

    getClassifier()
      .then(async (clf) => {
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

        chrome.runtime.sendMessage({
          type: 'ML_CLASSIFY_RESPONSE',
          data: {
            requestId,
            result: { isToxic: toxicScore > 0.5, confidence: toxicScore },
          },
        }).catch(() => {});
      })
      .catch(() => {
        chrome.runtime.sendMessage({
          type: 'ML_CLASSIFY_RESPONSE',
          data: {
            requestId,
            result: { isToxic: false, confidence: 0 },
          },
        }).catch(() => {});
      });
  }

  if (message.type === 'NSFW_WARMUP_INTERNAL') {
    const { requestId } = message.data;
    resetIdleTimer();

    ensureNsfwModel()
      .then(() => {
        chrome.runtime.sendMessage({
          type: 'NSFW_WARMUP_RESPONSE',
          data: { requestId, ok: true },
        }).catch(() => {});
      })
      .catch(() => {
        chrome.runtime.sendMessage({
          type: 'NSFW_WARMUP_RESPONSE',
          data: { requestId, ok: false },
        }).catch(() => {});
      });
  }

  if (message.type === 'NSFW_CLASSIFY_INTERNAL') {
    const { source, sensitivity, requestId, customThreshold } = message.data;
    resetIdleTimer();

    classifyImageInOffscreen(source, sensitivity, customThreshold)
      .then((result) => {
        chrome.runtime.sendMessage({
          type: 'NSFW_CLASSIFY_RESPONSE',
          data: { requestId, result },
        }).catch(() => {});
      })
      .catch(() => {
        // Fail-safe: return NSFW on any error
        chrome.runtime.sendMessage({
          type: 'NSFW_CLASSIFY_RESPONSE',
          data: {
            requestId,
            result: { isNSFW: true, score: 1 },
          },
        }).catch(() => {});
      });
  }
});

console.log('PG Patrol ML inference offscreen document loaded');
