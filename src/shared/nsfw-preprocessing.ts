/**
 * Shared NSFW image preprocessing constants and utilities.
 * Used by both the content script (nsfw-detector.ts) and the
 * offscreen document for cross-origin image classification.
 */

// ViT-Tiny model constants
export const MODEL_INPUT_SIZE = 384;

// ImageNet normalization constants (RGB)
export const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
export const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

/**
 * Apply softmax to convert raw logits to probabilities.
 */
export function softmax(logits: Float32Array | number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = Array.from(logits).map((l) => Math.exp(l - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

/**
 * Preprocess raw ImageData into a Float32 NCHW tensor for the ViT-Tiny model.
 * Applies ImageNet normalization: pixel = (pixel / 255 - mean) / std
 */
export function preprocessImageData(imageData: ImageData): Float32Array {
  const { data } = imageData;
  const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const float32Data = new Float32Array(3 * numPixels);

  for (let i = 0; i < numPixels; i++) {
    const rgbaIdx = i * 4;
    float32Data[i] = (data[rgbaIdx] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    float32Data[numPixels + i] = (data[rgbaIdx + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    float32Data[2 * numPixels + i] = (data[rgbaIdx + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return float32Data;
}
