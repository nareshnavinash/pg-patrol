import { DEFAULT_SETTINGS } from './types';
import type { PGPatrolSettings } from './types';

/**
 * Get current settings, merged with defaults for any missing fields.
 */
export async function getSettings(): Promise<PGPatrolSettings> {
  const stored = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

/**
 * Save partial settings update.
 */
export async function saveSettings(partial: Partial<PGPatrolSettings>): Promise<PGPatrolSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.sync.set({ settings: updated });
  return updated;
}

/**
 * Listen for settings changes.
 */
export function onSettingsChanged(callback: (settings: PGPatrolSettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area === 'sync' && changes.settings) {
      callback({ ...DEFAULT_SETTINGS, ...changes.settings.newValue });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Check if a site is whitelisted.
 */
export async function isSiteWhitelisted(hostname: string): Promise<boolean> {
  const settings = await getSettings();
  return settings.whitelistedSites.includes(hostname);
}

/**
 * Update cumulative stats. Single read-modify-write to avoid double storage reads.
 */
export async function incrementStats(wordsReplaced: number, imagesReplaced: number): Promise<void> {
  const stored = await chrome.storage.sync.get('settings');
  const current = { ...DEFAULT_SETTINGS, ...stored.settings };
  current.stats = {
    totalWordsReplaced: current.stats.totalWordsReplaced + wordsReplaced,
    totalImagesReplaced: current.stats.totalImagesReplaced + imagesReplaced,
  };
  await chrome.storage.sync.set({ settings: current });
}
