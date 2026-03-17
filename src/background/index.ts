import { MessageType } from '../shared/types';
import type { Message, StatsResponse, MLClassifyResult, ActivityEntry } from '../shared/types';
import { fetchAndCacheWordList } from '../shared/word-list-updater';
import { cacheImages, getAllCachedImages, rotateCachedImages } from './image-cache';

// Per-tab replacement counts
const tabStats = new Map<number, { wordsReplaced: number; imagesReplaced: number }>();

// Per-tab activity log (ring buffer, max 50 entries per tab)
const MAX_ACTIVITY_ENTRIES = 50;
const tabActivityLog = new Map<number, ActivityEntry[]>();

// ---- Offscreen document lifecycle ----
let offscreenCreated = false;
let mlRequestCounter = 0;
const pendingMLRequests = new Map<number, (result: MLClassifyResult) => void>();

let nsfwWarmupCounter = 0;
const pendingNSFWWarmups = new Map<number, (result: { ok: boolean }) => void>();

// NSFW image classification via offscreen
let nsfwRequestCounter = 0;
const pendingNSFWRequests = new Map<number, (result: { isNSFW: boolean; score: number }) => void>();

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenCreated) return;

  // Check if document already exists (Chrome 116+)
  if (chrome.offscreen?.hasDocument) {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) {
      offscreenCreated = true;
      return;
    }
  }

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('src/ml-inference/offscreen.html'),
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'ML text classification using Transformers.js',
    });
    offscreenCreated = true;
  } catch {
    // Document may already exist from a previous call
    offscreenCreated = true;
  }
}

function closeOffscreenDocument(): void {
  if (!offscreenCreated) return;
  chrome.offscreen?.closeDocument?.().catch(() => {});
  offscreenCreated = false;
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case MessageType.UPDATE_STATS: {
      if (tabId != null) {
        tabStats.set(tabId, {
          wordsReplaced: message.data.wordsReplaced,
          imagesReplaced: message.data.imagesReplaced,
        });
        // Update badge with word count
        const count = message.data.wordsReplaced;
        if (count > 0) {
          chrome.action.setBadgeText({ text: String(count), tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
        }
      }
      break;
    }

    case MessageType.GET_TAB_STATS: {
      const resolvedTabId = message.tabId ?? tabId;
      const stats = resolvedTabId ? tabStats.get(resolvedTabId) : undefined;
      const response: StatsResponse = {
        wordsReplaced: stats?.wordsReplaced ?? 0,
        imagesReplaced: stats?.imagesReplaced ?? 0,
      };
      sendResponse(response);
      return true; // async response
    }

    case MessageType.SETTINGS_CHANGED: {
      // Relay settings change to all content scripts
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {
              // Tab might not have content script loaded
            });
          }
        }
      });
      break;
    }

    case MessageType.LOG_ACTIVITY: {
      if (tabId != null) {
        let entries = tabActivityLog.get(tabId);
        if (!entries) {
          entries = [];
          tabActivityLog.set(tabId, entries);
        }
        entries.push(message.data);
        // Ring buffer: drop oldest on overflow
        if (entries.length > MAX_ACTIVITY_ENTRIES) {
          entries.shift();
        }
      }
      break;
    }

    case MessageType.GET_ACTIVITY_LOG: {
      const logTabId = message.tabId ?? tabId;
      const entries = logTabId ? (tabActivityLog.get(logTabId) ?? []) : [];
      sendResponse(entries);
      return true; // async response
    }

    case MessageType.ML_CLASSIFY_REQUEST: {
      const requestId = ++mlRequestCounter;

      // Store sendResponse callback for this request
      pendingMLRequests.set(requestId, sendResponse);

      // Timeout after 15 seconds
      setTimeout(() => {
        if (pendingMLRequests.has(requestId)) {
          pendingMLRequests.delete(requestId);
          sendResponse({ isToxic: false, confidence: 0 });
        }
      }, 15000);

      // Forward to offscreen document
      ensureOffscreenDocument().then(() => {
        chrome.runtime
          .sendMessage({
            type: MessageType.ML_CLASSIFY_INTERNAL,
            data: { text: message.data.text, requestId },
          })
          .catch(() => {
            // Offscreen doc might not be ready yet
            if (pendingMLRequests.has(requestId)) {
              pendingMLRequests.delete(requestId);
              sendResponse({ isToxic: false, confidence: 0 });
            }
          });
      });

      return true; // async response
    }

    case MessageType.ML_CLASSIFY_RESPONSE: {
      const { requestId, result } = message.data;
      const resolve = pendingMLRequests.get(requestId);
      if (resolve) {
        pendingMLRequests.delete(requestId);
        resolve(result);
      }
      break;
    }

    case MessageType.NSFW_WARMUP: {
      const warmupRequestId = ++nsfwWarmupCounter;

      pendingNSFWWarmups.set(warmupRequestId, sendResponse);

      setTimeout(() => {
        if (pendingNSFWWarmups.has(warmupRequestId)) {
          pendingNSFWWarmups.delete(warmupRequestId);
          sendResponse({ ok: false });
        }
      }, 15000);

      ensureOffscreenDocument().then(() => {
        chrome.runtime
          .sendMessage({
            type: MessageType.NSFW_WARMUP_INTERNAL,
            data: { requestId: warmupRequestId },
          })
          .catch(() => {
            if (pendingNSFWWarmups.has(warmupRequestId)) {
              pendingNSFWWarmups.delete(warmupRequestId);
              sendResponse({ ok: false });
            }
          });
      });

      return true;
    }

    case MessageType.NSFW_WARMUP_RESPONSE: {
      const { requestId, ok } = message.data;
      const resolve = pendingNSFWWarmups.get(requestId);
      if (resolve) {
        pendingNSFWWarmups.delete(requestId);
        resolve({ ok });
      }
      break;
    }

    case MessageType.NSFW_CLASSIFY_IMAGE: {
      const nsfwRequestId = ++nsfwRequestCounter;

      pendingNSFWRequests.set(nsfwRequestId, sendResponse);

      // Timeout after 30 seconds (image fetch + model inference)
      setTimeout(() => {
        if (pendingNSFWRequests.has(nsfwRequestId)) {
          pendingNSFWRequests.delete(nsfwRequestId);
          sendResponse({ isNSFW: true, score: 1 }); // Fail-safe
        }
      }, 30000);

      ensureOffscreenDocument().then(() => {
        chrome.runtime
          .sendMessage({
            type: MessageType.NSFW_CLASSIFY_INTERNAL,
            data: {
              source: message.data.source,
              sensitivity: message.data.sensitivity,
              requestId: nsfwRequestId,
              customThreshold: message.data.customThreshold,
            },
          })
          .catch(() => {
            if (pendingNSFWRequests.has(nsfwRequestId)) {
              pendingNSFWRequests.delete(nsfwRequestId);
              sendResponse({ isNSFW: true, score: 1 }); // Fail-safe
            }
          });
      });

      return true; // async response
    }

    case MessageType.NSFW_CLASSIFY_RESPONSE: {
      const { requestId: nsfwRespId, result: nsfwResult } = message.data;
      const nsfwResolve = pendingNSFWRequests.get(nsfwRespId);
      if (nsfwResolve) {
        pendingNSFWRequests.delete(nsfwRespId);
        nsfwResolve(nsfwResult);
      }
      break;
    }

    case MessageType.GET_REPLACEMENT_BATCH: {
      getAllCachedImages()
        .then((images) => sendResponse(images))
        .catch(() => sendResponse({ landscape: [], portrait: [], square: [] }));
      return true; // async response
    }

    case MessageType.OFFSCREEN_IDLE: {
      closeOffscreenDocument();
      break;
    }
  }
});

// Clean up tab stats and activity log when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
  tabActivityLog.delete(tabId);
});

// Periodic remote word list update (every 24 hours)
chrome.alarms.create('wordListUpdate', { periodInMinutes: 1440 });

// Daily replacement image cache rotation (every 24 hours)
chrome.alarms.create('refresh-replacements', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wordListUpdate') {
    fetchAndCacheWordList().catch(() => {
      // Network failure — cached/bundled defaults still work
    });
  }
  if (alarm.name === 'refresh-replacements') {
    rotateCachedImages().catch(() => {
      // Network failure — existing cached images still work
    });
  }
});

// Fetch word list on install/update; skip onboarding for existing users
chrome.runtime.onInstalled.addListener((details) => {
  fetchAndCacheWordList().catch(() => {
    // Silent fail — offline still works with bundled defaults
  });

  // Fill replacement image cache on install/update
  cacheImages().catch(() => {
    // Network failure — bundled fallbacks still work
  });

  // Existing users upgrading should skip the onboarding flow
  if (details.reason === 'update') {
    chrome.storage.sync
      .get('settings')
      .then((result) => {
        const current = result.settings || {};
        chrome.storage.sync.set({
          settings: { ...current, hasSeenOnboarding: true },
        });
      })
      .catch(() => {});
  }
});

console.log('PG Patrol background service worker loaded');
