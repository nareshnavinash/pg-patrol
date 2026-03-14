/**
 * Public API for ML-based text toxicity classification.
 * Sends classification requests to the background service worker,
 * which routes them to the offscreen document running Transformers.js.
 */

import { MessageType } from './types';
import type { MLClassifyResult } from './types';

/**
 * Classify text toxicity using the ML model in the offscreen document.
 * Returns { isToxic: false, confidence: 0 } on any error (model not loaded, timeout, etc.).
 */
export async function classifyToxicity(text: string): Promise<MLClassifyResult> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.ML_CLASSIFY_REQUEST,
      data: { text },
    });
    if (response && typeof response.isToxic === 'boolean') {
      return response as MLClassifyResult;
    }
    return { isToxic: false, confidence: 0 };
  } catch {
    return { isToxic: false, confidence: 0 };
  }
}
