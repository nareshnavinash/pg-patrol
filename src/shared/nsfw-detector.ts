/**
 * NSFW image detection entrypoint for content scripts.
 *
 * Model execution lives in the offscreen document so page CSP/runtime quirks
 * cannot break inference on real sites. The content script only prepares image
 * inputs and forwards them through extension messaging.
 */

import type { Sensitivity, NSFWImageInput } from './types';
import { MessageType } from './types';
import {
  MODEL_INPUT_SIZE,
  preprocessImageData,
} from './nsfw-preprocessing';

export { MODEL_INPUT_SIZE, softmax } from './nsfw-preprocessing';

export interface ClassificationResult {
  isNSFW: boolean;
  score: number;
  predictions: Array<{ className: string; probability: number }>;
  topClass: string;
}

const THRESHOLDS: Record<Sensitivity, number> = {
  mild: 0.85,
  moderate: 0.60,
  strict: 0.30,
};

let modelReady = false;
let modelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

function supportsUrlClassification(url: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('chrome-extension://')
  );
}

function runtimeSendMessage<TResponse>(message: unknown): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('chrome.runtime.sendMessage is unavailable'));
      return;
    }

    chrome.runtime.sendMessage(message, (response: TResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Warm the offscreen NSFW model so the first classification does not pay setup cost.
 */
export async function loadModel(): Promise<void> {
  if (modelReady) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoading = true;
  modelLoadPromise = runtimeSendMessage<{ ok: boolean }>({
    type: MessageType.NSFW_WARMUP,
  })
    .then((response) => {
      if (!response?.ok) {
        throw new Error('NSFW offscreen warmup failed');
      }
      modelReady = true;
    })
    .catch((error) => {
      modelLoadPromise = null;
      console.error('PG Patrol: Failed to warm NSFW model', error);
      throw error;
    })
    .finally(() => {
      modelLoading = false;
    });

  return modelLoadPromise;
}

export function isModelReady(): boolean {
  return modelReady;
}

export function isModelLoading(): boolean {
  return modelLoading;
}

/**
 * Preprocess an image into a 384x384 RGB tensor-friendly image array.
 * Used for blob/file inputs that the offscreen document cannot fetch by URL.
 */
export function preprocessImage(
  imgElement: HTMLImageElement | HTMLCanvasElement,
): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgElement, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  return preprocessImageData(imageData);
}

function extractPixelPayload(imgElement: HTMLImageElement): NSFWImageInput {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgElement, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  return {
    kind: 'pixels',
    width: MODEL_INPUT_SIZE,
    height: MODEL_INPUT_SIZE,
    data: imageData.data,
  };
}

function buildResult(
  nsfwProb: number,
  sfwProb: number,
  sensitivity: Sensitivity,
  customThreshold?: number | null,
): ClassificationResult {
  const threshold = customThreshold != null ? customThreshold : THRESHOLDS[sensitivity];
  const isNSFW = nsfwProb >= threshold;

  const predictions = [
    { className: 'Neutral', probability: sfwProb * 0.7 },
    { className: 'Drawing', probability: sfwProb * 0.3 },
    { className: 'Porn', probability: nsfwProb * 0.5 },
    { className: 'Hentai', probability: nsfwProb * 0.3 },
    { className: 'Sexy', probability: nsfwProb * 0.2 },
  ];

  predictions.sort((a, b) => b.probability - a.probability);

  return {
    isNSFW,
    score: nsfwProb,
    predictions,
    topClass: predictions[0].className,
  };
}

async function classifyViaOffscreen(
  source: NSFWImageInput,
  sensitivity: Sensitivity,
  customThreshold?: number | null,
): Promise<ClassificationResult> {
  try {
    await loadModel();

    const result = await runtimeSendMessage<{ isNSFW: boolean; score: number }>({
      type: MessageType.NSFW_CLASSIFY_IMAGE,
      data: { source, sensitivity, customThreshold },
    });

    const sfwProb = 1 - result.score;
    return buildResult(result.score, sfwProb, sensitivity, customThreshold);
  } catch {
    return buildResult(1, 0, sensitivity, customThreshold);
  }
}

export async function classifyImageUrl(
  imageUrl: string,
  sensitivity: Sensitivity = 'moderate',
  customThreshold?: number | null,
): Promise<ClassificationResult> {
  return classifyViaOffscreen(
    { kind: 'url', imageUrl },
    sensitivity,
    customThreshold,
  );
}

/**
 * Classify an image element as NSFW or safe.
 * Prefers offscreen URL classification; uses pixel payloads for blob/file URLs.
 */
export async function classifyImage(
  imgElement: HTMLImageElement,
  sensitivity: Sensitivity = 'moderate',
  customThreshold?: number | null,
): Promise<ClassificationResult> {
  const src = imgElement.currentSrc || imgElement.src || null;
  if (supportsUrlClassification(src)) {
    return classifyImageUrl(src!, sensitivity, customThreshold);
  }

  try {
    const pixelPayload = extractPixelPayload(imgElement);
    return classifyViaOffscreen(pixelPayload, sensitivity, customThreshold);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError' && src) {
      return classifyViaOffscreen({ kind: 'url', imageUrl: src }, sensitivity, customThreshold);
    }
    return buildResult(1, 0, sensitivity, customThreshold);
  }
}

/**
 * Reset the local readiness state. The offscreen document may still keep the
 * model warm; callers only rely on this to force a fresh warmup request later.
 */
export function unloadModel(): void {
  modelReady = false;
  modelLoading = false;
  modelLoadPromise = null;
}
