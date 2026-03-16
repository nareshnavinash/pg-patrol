/**
 * Offscreen document for ML text classification and NSFW image classification.
 * Chrome-only: runs in an isolated page context to comply with MV3 CSP
 * restrictions on WASM in service workers.
 *
 * Delegates all ML work to the shared inference-engine module.
 *
 * Communication: Background SW sends *_INTERNAL messages,
 * this script processes them and sends *_RESPONSE back.
 */

import { createInferenceEngine } from './inference-engine';

const engine = createInferenceEngine({
  getAssetURL: (path) => chrome.runtime.getURL(path),
  onIdle: () => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_IDLE' }).catch(() => {});
  },
});

// ---- Message Handling ----

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ML_CLASSIFY_INTERNAL') {
    const { text, requestId } = message.data;

    engine
      .classifyText(text)
      .then((result) => {
        chrome.runtime
          .sendMessage({
            type: 'ML_CLASSIFY_RESPONSE',
            data: { requestId, result },
          })
          .catch(() => {});
      })
      .catch(() => {
        chrome.runtime
          .sendMessage({
            type: 'ML_CLASSIFY_RESPONSE',
            data: {
              requestId,
              result: { isToxic: false, confidence: 0 },
            },
          })
          .catch(() => {});
      });
  }

  if (message.type === 'NSFW_WARMUP_INTERNAL') {
    const { requestId } = message.data;
    engine.resetIdleTimer();

    engine
      .warmupNSFW()
      .then(() => {
        chrome.runtime
          .sendMessage({
            type: 'NSFW_WARMUP_RESPONSE',
            data: { requestId, ok: true },
          })
          .catch(() => {});
      })
      .catch(() => {
        chrome.runtime
          .sendMessage({
            type: 'NSFW_WARMUP_RESPONSE',
            data: { requestId, ok: false },
          })
          .catch(() => {});
      });
  }

  if (message.type === 'NSFW_CLASSIFY_INTERNAL') {
    const { source, sensitivity, requestId, customThreshold } = message.data;
    engine.resetIdleTimer();

    engine
      .classifyImage(source, sensitivity, customThreshold)
      .then((result) => {
        chrome.runtime
          .sendMessage({
            type: 'NSFW_CLASSIFY_RESPONSE',
            data: { requestId, result },
          })
          .catch(() => {});
      })
      .catch(() => {
        // Fail-safe: return NSFW on any error
        chrome.runtime
          .sendMessage({
            type: 'NSFW_CLASSIFY_RESPONSE',
            data: {
              requestId,
              result: { isNSFW: true, score: 1 },
            },
          })
          .catch(() => {});
      });
  }
});

console.log('PG Patrol ML inference offscreen document loaded');
