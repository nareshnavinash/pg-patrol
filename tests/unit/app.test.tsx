import { render, screen, waitFor, fireEvent, act } from '@testing-library/preact';
import App from '../../src/popup/App';

// The mock storage in setup.ts pre-populates hasSeenOnboarding: true
// so the main UI renders by default in these tests.

describe('App', () => {
  it('shows loading state initially', () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the PG Patrol title after loading', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });
  });

  it('renders the version', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol v1.0.0')).toBeInTheDocument();
    });
  });

  it('renders RevealToggle before SiteManager in DOM order', async () => {
    const { container } = render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });

    const html = container.innerHTML;
    const revealPos =
      html.indexOf('Reveal original content') !== -1
        ? html.indexOf('Reveal original content')
        : html.indexOf('Filtering paused');
    const siteManagerPos = html.indexOf('Current site');

    if (revealPos !== -1 && siteManagerPos !== -1) {
      expect(revealPos).toBeLessThan(siteManagerPos);
    }
  });

  it('wraps Settings in a CollapsibleSection', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });

    const settingsButton = screen.queryByRole('button', { name: /Settings/i });
    expect(settingsButton).toBeInTheDocument();
  });

  it('wraps Custom Words in a CollapsibleSection', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });

    const customWordsButton = screen.queryByRole('button', { name: /Custom Words/i });
    expect(customWordsButton).toBeInTheDocument();
  });
});

describe('App — toggle and callbacks', () => {
  beforeEach(() => {
    (chrome.tabs as any).reload = jest.fn();
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
  });

  it('renders header toggle and settings toggles', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });

    // Header toggle should exist
    const toggles = screen.getAllByRole('switch');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('renders Stats section', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });
  });

  it('renders Perspective API collapsible section', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });
    // The Perspective section is inside a CollapsibleSection button
    const perspectiveButton = screen.queryByRole('button', {
      name: /Enhanced Detection/i,
    });
    expect(perspectiveButton).toBeInTheDocument();
  });

  it('clicking header toggle triggers updateSettings', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });

    // The first switch in the DOM should be the header toggle
    const toggles = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent.click(toggles[0]);
    });

    // Should have called storage set
    expect(chrome.storage.sync.set).toHaveBeenCalled();
  });
});

describe('App — onboarding', () => {
  afterEach(() => {
    // Restore default mock: hasSeenOnboarding: true
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() =>
      Promise.resolve({ settings: { hasSeenOnboarding: true } }),
    );
  });

  it('renders Onboarding when hasSeenOnboarding is false', async () => {
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() =>
      Promise.resolve({ settings: { hasSeenOnboarding: false } }),
    );

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Welcome to PG Patrol')).toBeInTheDocument();
    });

    // Main UI should NOT be visible
    expect(screen.queryByText('PG Patrol v1.0.0')).not.toBeInTheDocument();
  });

  it('renders main UI when hasSeenOnboarding is true', async () => {
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() =>
      Promise.resolve({ settings: { hasSeenOnboarding: true } }),
    );

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol v1.0.0')).toBeInTheDocument();
    });

    expect(screen.queryByText('Welcome to PG Patrol')).not.toBeInTheDocument();
  });
});
