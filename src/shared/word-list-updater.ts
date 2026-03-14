/**
 * Remote word list updater service.
 * Fetches delta updates from a remote endpoint, caches in chrome.storage.local,
 * and applies to filtering engines.
 */

import { addCustomProfanity, addCustomSafeWords } from './profanity-engine';
import { addCustomFunnyWords } from './funny-words';
import { addCustomTriggers, addCustomSafeContext } from './negative-news-words';

/** Schema for the remote word list delta JSON. */
export interface RemoteWordListDelta {
  version: number;
  lastModified: string;
  profanity?: {
    add?: string[];
    remove?: string[];
    addSafe?: string[];
  };
  negativeNews?: {
    addTriggers?: string[];
    addAmplifiers?: string[];
    addSafeContext?: string[];
  };
  funnyWords?: {
    add?: Record<string, string[]>;
  };
}

interface CachedWordList {
  delta: RemoteWordListDelta;
  lastFetched: number;
}

const STORAGE_KEY = 'remoteWordList';
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default remote URL — can be overridden for testing
let remoteUrl = 'https://pg-patrol.github.io/wordlists/v1/updates.json';

/**
 * Set the remote URL (useful for testing).
 */
export function setRemoteUrl(url: string): void {
  remoteUrl = url;
}

/**
 * Check if enough time has passed since last fetch.
 */
export async function shouldFetch(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const cached = stored[STORAGE_KEY] as CachedWordList | undefined;
    if (!cached) return true;
    return Date.now() - cached.lastFetched > FETCH_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Fetch the remote word list delta from the configured URL.
 */
export async function fetchRemoteWordList(): Promise<RemoteWordListDelta | null> {
  try {
    const response = await fetch(remoteUrl);
    if (!response.ok) return null;
    const data: RemoteWordListDelta = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the cached word list from chrome.storage.local.
 */
export async function getCachedWordList(): Promise<RemoteWordListDelta | null> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const cached = stored[STORAGE_KEY] as CachedWordList | undefined;
    return cached?.delta ?? null;
  } catch {
    return null;
  }
}

/**
 * Cache the word list delta to chrome.storage.local.
 */
async function cacheWordList(delta: RemoteWordListDelta): Promise<void> {
  const cached: CachedWordList = {
    delta,
    lastFetched: Date.now(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: cached });
}

/**
 * Apply a word list delta to the filtering engines.
 */
export function applyWordListDelta(delta: RemoteWordListDelta): void {
  if (delta.profanity) {
    if (delta.profanity.add?.length) {
      addCustomProfanity(delta.profanity.add);
    }
    if (delta.profanity.addSafe?.length) {
      addCustomSafeWords(delta.profanity.addSafe);
    }
  }

  if (delta.negativeNews) {
    if (delta.negativeNews.addTriggers?.length) {
      addCustomTriggers(delta.negativeNews.addTriggers);
    }
    if (delta.negativeNews.addSafeContext?.length) {
      addCustomSafeContext(delta.negativeNews.addSafeContext);
    }
  }

  if (delta.funnyWords?.add) {
    addCustomFunnyWords(delta.funnyWords.add);
  }
}

/**
 * Fetch remote word list, cache it, and return the delta.
 * Falls back to cached version on network failure.
 */
export async function fetchAndCacheWordList(): Promise<RemoteWordListDelta | null> {
  const remote = await fetchRemoteWordList();
  if (remote) {
    await cacheWordList(remote);
    return remote;
  }
  // Fall back to cached
  return getCachedWordList();
}

/**
 * Load and apply the remote word list (cached or fresh).
 * Called during content script init.
 */
export async function loadRemoteWordList(): Promise<RemoteWordListDelta | null> {
  const cached = await getCachedWordList();
  if (cached) {
    applyWordListDelta(cached);
  }
  return cached;
}
