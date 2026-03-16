import {
  getSettings,
  saveSettings,
  isSiteWhitelisted,
  incrementStats,
  onSettingsChanged,
} from '../../src/shared/storage';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

describe('storage', () => {
  beforeEach(() => {
    // Reset mock storage
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() => Promise.resolve({}));
    (chrome.storage.sync.set as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  describe('getSettings', () => {
    it('returns defaults when nothing is stored', async () => {
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('merges stored values with defaults', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValueOnce({
        settings: { enabled: false },
      });
      const settings = await getSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.textFilterEnabled).toBe(true); // default
    });
  });

  describe('saveSettings', () => {
    it('saves partial settings', async () => {
      await saveSettings({ enabled: false });
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('isSiteWhitelisted', () => {
    it('returns false for non-whitelisted site', async () => {
      const result = await isSiteWhitelisted('example.com');
      expect(result).toBe(false);
    });

    it('returns true for whitelisted site', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValueOnce({
        settings: { whitelistedSites: ['example.com'] },
      });
      const result = await isSiteWhitelisted('example.com');
      expect(result).toBe(true);
    });
  });

  describe('incrementStats', () => {
    it('increments word and image counts', async () => {
      await incrementStats(5, 2);
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('onSettingsChanged', () => {
    let capturedListener: (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => void;

    beforeEach(() => {
      (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation(
        (fn: typeof capturedListener) => {
          capturedListener = fn;
        },
      );
    });

    it('calls callback when sync area settings change', () => {
      const callback = jest.fn();
      onSettingsChanged(callback);

      const newValue = { enabled: false };
      capturedListener({ settings: { newValue, oldValue: {} } }, 'sync');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        ...newValue,
      });
    });

    it('ignores changes from non-sync areas', () => {
      const callback = jest.fn();
      onSettingsChanged(callback);

      capturedListener({ settings: { newValue: { enabled: false }, oldValue: {} } }, 'local');

      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores changes without settings key', () => {
      const callback = jest.fn();
      onSettingsChanged(callback);

      capturedListener({ someOtherKey: { newValue: 'foo', oldValue: 'bar' } }, 'sync');

      expect(callback).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function that calls removeListener', () => {
      const callback = jest.fn();
      const unsubscribe = onSettingsChanged(callback);

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(capturedListener);

      unsubscribe();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(capturedListener);
    });
  });
});
