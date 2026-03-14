import { useState, useEffect, useCallback } from 'preact/hooks';
import { getSettings, saveSettings, onSettingsChanged } from '../../shared/storage';
import { DEFAULT_SETTINGS } from '../../shared/types';
import type { PGPatrolSettings } from '../../shared/types';

/**
 * React hook that syncs component state with Chrome storage.
 */
export function useStorage() {
  const [settings, setSettings] = useState<PGPatrolSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const unsubscribe = onSettingsChanged((newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<PGPatrolSettings>) => {
      const updated = await saveSettings(partial);
      setSettings(updated);

      // Notify content scripts
      chrome.runtime.sendMessage({
        type: 'SETTINGS_CHANGED',
        data: partial,
      }).catch(() => {
        // Popup might not have background ready
      });
    },
    [],
  );

  return { settings, loading, updateSettings };
}
