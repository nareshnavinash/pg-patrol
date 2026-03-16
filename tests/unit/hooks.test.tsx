import { render, screen, act, waitFor } from '@testing-library/preact';
import { useCurrentTab } from '../../src/popup/hooks/useCurrentTab';
import { useToast } from '../../src/popup/hooks/useToast';
import { useStorage } from '../../src/popup/hooks/useStorage';
import { DEFAULT_SETTINGS as _DEFAULT_SETTINGS } from '../../src/shared/types';
import type { PGPatrolSettings } from '../../src/shared/types';

// Helper component that renders hook output as JSON
function HookRenderer<T>({ hook, args }: { hook: (...a: any[]) => T; args?: any[] }) {
  const result = hook(...(args || []));
  return <div data-testid="result">{JSON.stringify(result)}</div>;
}

function getResult() {
  return JSON.parse(screen.getByTestId('result').textContent!);
}

// ----------------------------------------------------------------
// useCurrentTab
// ----------------------------------------------------------------
describe('useCurrentTab', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sets hostname from tab URL', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValueOnce([
      { id: 42, url: 'https://example.com/page' },
    ]);

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      const result = getResult();
      expect(result.hostname).toBe('example.com');
      expect(result.tabId).toBe(42);
    });
  });

  it('sets tabId from tab', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValueOnce([{ id: 99, url: 'https://test.org' }]);

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      expect(getResult().tabId).toBe(99);
    });
  });

  it('handles tab with no URL', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValueOnce([{ id: 7 }]);

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      const result = getResult();
      expect(result.hostname).toBe('');
      expect(result.tabId).toBe(7);
    });
  });

  it('handles tab with invalid URL', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValueOnce([{ id: 10, url: 'not-a-valid-url' }]);

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      const result = getResult();
      // URL constructor throws for invalid URL, so hostname stays empty
      expect(result.hostname).toBe('');
      expect(result.tabId).toBe(10);
    });
  });

  it('handles no tab returned', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValueOnce([]);

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      const result = getResult();
      expect(result.hostname).toBe('');
      expect(result.tabId).toBeUndefined();
    });
  });

  it('handles tabs.query error', async () => {
    (chrome.tabs.query as jest.Mock).mockRejectedValueOnce(new Error('API error'));

    await act(async () => {
      render(<HookRenderer hook={useCurrentTab} />);
    });

    await waitFor(() => {
      const result = getResult();
      expect(result.hostname).toBe('');
      expect(result.tabId).toBeUndefined();
    });
  });
});

// ----------------------------------------------------------------
// useToast
// ----------------------------------------------------------------
describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // We need a component that exposes showToast via a button
  function ToastTestComponent() {
    const { toast, showToast } = useToast();
    return (
      <div>
        <div data-testid="toast">{JSON.stringify(toast)}</div>
        <button data-testid="show-a" onClick={() => showToast('Hello')}>
          Show A
        </button>
        <button data-testid="show-b" onClick={() => showToast('World')}>
          Show B
        </button>
      </div>
    );
  }

  it('shows toast with message', () => {
    render(<ToastTestComponent />);

    act(() => {
      screen.getByTestId('show-a').click();
    });

    const toast = JSON.parse(screen.getByTestId('toast').textContent!);
    expect(toast.message).toBe('Hello');
    expect(toast.visible).toBe(true);
  });

  it('auto-dismisses after timeout', () => {
    render(<ToastTestComponent />);

    act(() => {
      screen.getByTestId('show-a').click();
    });

    // Visible immediately
    expect(JSON.parse(screen.getByTestId('toast').textContent!).visible).toBe(true);

    // Advance time past the 1500ms timeout
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(JSON.parse(screen.getByTestId('toast').textContent!).visible).toBe(false);
  });

  it('clears previous timer when showing new toast', () => {
    render(<ToastTestComponent />);

    act(() => {
      screen.getByTestId('show-a').click();
    });

    // Advance partway through first timer
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Show another toast before first one dismisses
    act(() => {
      screen.getByTestId('show-b').click();
    });

    const toast = JSON.parse(screen.getByTestId('toast').textContent!);
    expect(toast.message).toBe('World');
    expect(toast.visible).toBe(true);

    // Advance past the remaining time of the first timer (500ms) - should still be visible
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(JSON.parse(screen.getByTestId('toast').textContent!).visible).toBe(true);

    // Advance through the second timer's full 1500ms (1000ms remaining)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(JSON.parse(screen.getByTestId('toast').textContent!).visible).toBe(false);
  });
});

// ----------------------------------------------------------------
// useStorage
// ----------------------------------------------------------------
describe('useStorage', () => {
  let _onSettingsChangedCallback: ((s: PGPatrolSettings) => void) | null = null;

  beforeEach(() => {
    jest.restoreAllMocks();
    _onSettingsChangedCallback = null;

    // Default mock: storage returns defaults, onSettingsChanged captured
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() =>
      Promise.resolve({ settings: {} }),
    );
    (chrome.storage.sync.set as jest.Mock).mockImplementation(() => Promise.resolve());
    (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation(() => {});
    (chrome.storage.onChanged.removeListener as jest.Mock).mockImplementation(() => {});
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(() => Promise.resolve());
    (chrome.tabs.query as jest.Mock).mockImplementation(() => Promise.resolve([]));

    // Add reload mock
    (chrome.tabs as any).reload = jest.fn(() => Promise.resolve());
  });

  // Helper component for useStorage
  function StorageTestComponent() {
    const { settings, loading, updateSettings } = useStorage();
    return (
      <div>
        <div data-testid="loading">{String(loading)}</div>
        <div data-testid="settings">{JSON.stringify(settings)}</div>
        <button data-testid="update-enabled" onClick={() => updateSettings({ enabled: false })}>
          Disable
        </button>
        <button
          data-testid="update-text"
          onClick={() => updateSettings({ textFilterEnabled: false })}
        >
          Text Off
        </button>
        <button
          data-testid="update-image"
          onClick={() => updateSettings({ imageFilterEnabled: false })}
        >
          Image Off
        </button>
        <button
          data-testid="update-sensitivity"
          onClick={() => updateSettings({ sensitivity: 'mild' })}
        >
          Mild
        </button>
        <button
          data-testid="update-threshold"
          onClick={() => updateSettings({ customThreshold: 0.5 })}
        >
          Threshold
        </button>
      </div>
    );
  }

  it('starts with loading=true, resolves to loaded settings', async () => {
    const storedSettings = { enabled: false, sensitivity: 'mild' as const };
    (chrome.storage.sync.get as jest.Mock).mockResolvedValueOnce({
      settings: storedSettings,
    });

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    const settings = JSON.parse(screen.getByTestId('settings').textContent!);
    expect(settings.enabled).toBe(false);
    expect(settings.sensitivity).toBe('mild');
    // Defaults should be merged
    expect(settings.textFilterEnabled).toBe(true);
  });

  it('handles getSettings error and sets loading to false', async () => {
    (chrome.storage.sync.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('updateSettings saves and sends message', async () => {
    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Update with a non-structural change
    await act(async () => {
      screen.getByTestId('update-text').click();
    });

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SETTINGS_CHANGED',
          data: { textFilterEnabled: false },
        }),
      );
    });
  });

  it('updateSettings triggers reload for structural changes (enabled)', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('update-enabled').click();
    });

    await waitFor(() => {
      expect((chrome.tabs as any).reload).toHaveBeenCalledWith(1);
    });
  });

  it('updateSettings triggers reload for imageFilterEnabled', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 2 }]);

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('update-image').click();
    });

    await waitFor(() => {
      expect((chrome.tabs as any).reload).toHaveBeenCalledWith(2);
    });
  });

  it('updateSettings triggers reload for sensitivity', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 3 }]);

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('update-sensitivity').click();
    });

    await waitFor(() => {
      expect((chrome.tabs as any).reload).toHaveBeenCalledWith(3);
    });
  });

  it('updateSettings triggers reload for customThreshold', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 4 }]);

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('update-threshold').click();
    });

    await waitFor(() => {
      expect((chrome.tabs as any).reload).toHaveBeenCalledWith(4);
    });
  });

  it('updateSettings does NOT reload for non-structural changes', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 5 }]);

    await act(async () => {
      render(<StorageTestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Reset the reload mock to track only calls from the update
    (chrome.tabs as any).reload.mockClear();

    await act(async () => {
      screen.getByTestId('update-text').click();
    });

    // Allow async operations to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect((chrome.tabs as any).reload).not.toHaveBeenCalled();
  });
});
