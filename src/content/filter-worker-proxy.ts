/**
 * Proxy for the filter Web Worker.
 * Provides an async API for text processing with automatic fallback
 * to synchronous inline execution when the worker is unavailable.
 */

import { replaceProfanity } from '../shared/profanity-engine';
import { scoreText } from '../shared/negative-news-engine';
import type { FilterResult, NegativeContentResult, Sensitivity } from '../shared/types';
import type { RemoteWordListDelta } from '../shared/word-list-updater';
import type { WorkerResponse } from './filter-worker';

let worker: Worker | null = null;
let requestId = 0;
let crashCount = 0;
let lastCustomWords: {
  customBlockedWords: string[];
  customSafeWords: string[];
  customNegativeTriggers: string[];
  customSafeContext: string[];
} | null = null;

const MAX_CRASH_RETRIES = 3;

const pendingRequests = new Map<
  number,
  { resolve: (value: any) => void; timer: ReturnType<typeof setTimeout> }
>();

const TIMEOUT_MS = 5000;

/**
 * Initialize the filter worker. Returns true if the worker was created.
 */
export function initFilterWorker(): boolean {
  try {
    const workerUrl = chrome.runtime.getURL('filter-worker.js');
    worker = new Worker(workerUrl, { type: 'module' });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if ('id' in msg) {
        const pending = pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(msg.id);
          pending.resolve(msg.results);
        }
      }
    };

    worker.onerror = () => {
      worker = null;
      crashCount++;
      if (crashCount < MAX_CRASH_RETRIES) {
        // Attempt to reinitialize after a crash
        initFilterWorker();
        if (worker && lastCustomWords) {
          syncCustomWords(lastCustomWords);
        }
      }
    };

    return true;
  } catch {
    worker = null;
    return false;
  }
}

/**
 * Filter text using the worker (async) or fallback (sync).
 */
export function filterTextBatch(
  texts: string[],
  sensitivity: Sensitivity,
): Promise<FilterResult[]> {
  if (!worker) {
    return Promise.resolve(texts.map((t) => replaceProfanity(t, sensitivity)));
  }

  const id = ++requestId;
  return new Promise<FilterResult[]>((resolve) => {
    const timer = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        // Timeout — fall back to sync
        resolve(texts.map((t) => replaceProfanity(t, sensitivity)));
      }
    }, TIMEOUT_MS);

    pendingRequests.set(id, { resolve, timer });
    worker!.postMessage({ type: 'FILTER_TEXT', id, texts, sensitivity });
  });
}

/**
 * Score text for negative content using the worker (async) or fallback (sync).
 */
export function scoreTextBatch(texts: string[]): Promise<NegativeContentResult[]> {
  if (!worker) {
    return Promise.resolve(texts.map((t) => scoreText(t)));
  }

  const id = ++requestId;
  return new Promise<NegativeContentResult[]>((resolve) => {
    const timer = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve(texts.map((t) => scoreText(t)));
      }
    }, TIMEOUT_MS);

    pendingRequests.set(id, { resolve, timer });
    worker!.postMessage({ type: 'SCORE_TEXT', id, texts });
  });
}

/**
 * Sync custom words to the worker.
 */
export function syncCustomWords(words: {
  customBlockedWords: string[];
  customSafeWords: string[];
  customNegativeTriggers: string[];
  customSafeContext: string[];
}): void {
  lastCustomWords = words;
  if (!worker) return;
  worker.postMessage({ type: 'SET_CUSTOM_WORDS', ...words });
}

/**
 * Apply a remote word list delta to the worker.
 */
export function applyWorkerWordListDelta(delta: RemoteWordListDelta): void {
  if (!worker) return;
  worker.postMessage({ type: 'APPLY_WORD_DELTA', delta });
}

/**
 * Terminate the worker and reject all pending requests.
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  crashCount = 0;
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pendingRequests.delete(id);
    pending.resolve([]);
  }
}

/**
 * Check if the worker is active.
 */
export function isWorkerActive(): boolean {
  return worker !== null;
}
