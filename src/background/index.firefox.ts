/**
 * Firefox background page entry point.
 *
 * Combines the message-routing logic of the Chrome background service worker
 * with direct ML inference (no offscreen document — Firefox MV3 background
 * pages have a full DOM context where WASM + OffscreenCanvas work natively).
 *
 * Message flow:
 *   Content Script → Background Page → inference-engine (direct call) → Background Page → Content Script
 */

import { MessageType } from '../shared/types';
import type { Message, StatsResponse, ActivityEntry } from '../shared/types';
import { fetchAndCacheWordList } from '../shared/word-list-updater';
import { createInferenceEngine } from '../ml-inference/inference-engine';

// Per-tab replacement counts
const tabStats = new Map<number, { wordsReplaced: number; imagesReplaced: number }>();

// Per-tab activity log (ring buffer, max 50 entries per tab)
const MAX_ACTIVITY_ENTRIES = 50;
const tabActivityLog = new Map<number, ActivityEntry[]>();

// ML inference engine — runs directly in Firefox's background page context
const inferenceEngine = createInferenceEngine({
  getAssetURL: (path) => chrome.runtime.getURL(path),
  onIdle: () => {
    // No offscreen document to close in Firefox — models disposed silently
  },
});

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
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
        const entries = logTabId ? tabActivityLog.get(logTabId) ?? [] : [];
        sendResponse(entries);
        return true; // async response
      }

      // ---- ML classification — direct call (no offscreen document) ----

      case MessageType.ML_CLASSIFY_REQUEST: {
        const text = message.data.text;
        let responded = false;

        // Timeout after 15 seconds
        const timeoutId = setTimeout(() => {
          if (!responded) {
            responded = true;
            sendResponse({ isToxic: false, confidence: 0 });
          }
        }, 15000);

        inferenceEngine.classifyText(text)
          .then((result) => {
            if (!responded) {
              responded = true;
              clearTimeout(timeoutId);
              sendResponse(result);
            }
          })
          .catch(() => {
            if (!responded) {
              responded = true;
              clearTimeout(timeoutId);
              sendResponse({ isToxic: false, confidence: 0 });
            }
          });

        return true; // async response
      }

      // ---- NSFW warmup — direct call ----

      case MessageType.NSFW_WARMUP: {
        let warmupResponded = false;

        const warmupTimeoutId = setTimeout(() => {
          if (!warmupResponded) {
            warmupResponded = true;
            sendResponse({ ok: false });
          }
        }, 15000);

        inferenceEngine.warmupNSFW()
          .then(() => {
            if (!warmupResponded) {
              warmupResponded = true;
              clearTimeout(warmupTimeoutId);
              sendResponse({ ok: true });
            }
          })
          .catch(() => {
            if (!warmupResponded) {
              warmupResponded = true;
              clearTimeout(warmupTimeoutId);
              sendResponse({ ok: false });
            }
          });

        return true;
      }

      // ---- NSFW image classify — direct call ----

      case MessageType.NSFW_CLASSIFY_IMAGE: {
        const { source, sensitivity, customThreshold } = message.data;
        let nsfwResponded = false;

        // Timeout after 30 seconds (image fetch + model inference)
        const nsfwTimeoutId = setTimeout(() => {
          if (!nsfwResponded) {
            nsfwResponded = true;
            sendResponse({ isNSFW: true, score: 1 }); // Fail-safe
          }
        }, 30000);

        inferenceEngine.classifyImage(source, sensitivity, customThreshold)
          .then((result) => {
            if (!nsfwResponded) {
              nsfwResponded = true;
              clearTimeout(nsfwTimeoutId);
              sendResponse(result);
            }
          })
          .catch(() => {
            if (!nsfwResponded) {
              nsfwResponded = true;
              clearTimeout(nsfwTimeoutId);
              sendResponse({ isNSFW: true, score: 1 }); // Fail-safe
            }
          });

        return true; // async response
      }

      // Chrome-offscreen-specific messages — ignored in Firefox
      case MessageType.ML_CLASSIFY_RESPONSE:
      case MessageType.NSFW_WARMUP_RESPONSE:
      case MessageType.NSFW_CLASSIFY_RESPONSE:
      case MessageType.OFFSCREEN_IDLE:
        break;
    }
  },
);

// Clean up tab stats and activity log when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
  tabActivityLog.delete(tabId);
});

// Periodic remote word list update (every 24 hours)
chrome.alarms.create('wordListUpdate', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wordListUpdate') {
    fetchAndCacheWordList().catch(() => {
      // Network failure — cached/bundled defaults still work
    });
  }
});

// Fetch word list on install/update; skip onboarding for existing users
chrome.runtime.onInstalled.addListener((details) => {
  fetchAndCacheWordList().catch(() => {
    // Silent fail — offline still works with bundled defaults
  });

  // Existing users upgrading should skip the onboarding flow
  if (details.reason === 'update') {
    chrome.storage.sync.get('settings').then((result) => {
      const current = result.settings || {};
      chrome.storage.sync.set({
        settings: { ...current, hasSeenOnboarding: true },
      });
    }).catch(() => {});
  }
});

console.log('PG Patrol background page loaded (Firefox)');
