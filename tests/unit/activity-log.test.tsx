import { render, screen, waitFor } from '@testing-library/preact';
import ActivityLog from '../../src/popup/components/ActivityLog';
import type { ActivityEntry } from '../../src/shared/types';

describe('ActivityLog', () => {
  const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
  const mockTabsQuery = chrome.tabs.query as jest.Mock;

  beforeEach(() => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: { id: number }[]) => void) => {
      cb([{ id: 42 }]);
    });
  });

  afterEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockImplementation(() => Promise.resolve());
    mockTabsQuery.mockReset();
    mockTabsQuery.mockImplementation(() => Promise.resolve([]));
  });

  it('renders empty state when no entries', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, cb?: (response: ActivityEntry[]) => void) => {
        cb?.([]);
        return Promise.resolve();
      },
    );

    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText('No activity on this page yet')).toBeInTheDocument();
    });
  });

  it('renders activity entries', async () => {
    const entries: ActivityEntry[] = [
      { type: 'word', original: 'badword', replacement: 'unicorn', timestamp: Date.now() - 30000 },
      { type: 'image', original: 'https://example.com/nsfw.jpg', timestamp: Date.now() - 120000 },
      { type: 'block', original: 'Distressing news content here', category: 'violence', timestamp: Date.now() - 5000 },
    ];

    mockSendMessage.mockImplementation(
      (_msg: unknown, cb?: (response: ActivityEntry[]) => void) => {
        cb?.(entries);
        return Promise.resolve();
      },
    );

    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText(/badword/)).toBeInTheDocument();
    });

    expect(screen.getByText(/unicorn/)).toBeInTheDocument();
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Distressing news/)).toBeInTheDocument();
    expect(screen.getByText(/violence/)).toBeInTheDocument();
  });

  it('truncates long original text to 40 chars', async () => {
    const longText = 'A'.repeat(60);
    const entries: ActivityEntry[] = [
      { type: 'word', original: longText, replacement: 'replaced', timestamp: Date.now() },
    ];

    mockSendMessage.mockImplementation(
      (_msg: unknown, cb?: (response: ActivityEntry[]) => void) => {
        cb?.(entries);
        return Promise.resolve();
      },
    );

    render(<ActivityLog />);
    await waitFor(() => {
      // Should show first 40 chars + ellipsis
      expect(screen.getByText('A'.repeat(40) + '...')).toBeInTheDocument();
    });
  });

  it('shows badge count on the collapsible section', async () => {
    const entries: ActivityEntry[] = [
      { type: 'word', original: 'bad', replacement: 'good', timestamp: Date.now() },
      { type: 'image', original: 'img.jpg', timestamp: Date.now() },
    ];

    mockSendMessage.mockImplementation(
      (_msg: unknown, cb?: (response: ActivityEntry[]) => void) => {
        cb?.(entries);
        return Promise.resolve();
      },
    );

    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows relative timestamps', async () => {
    const entries: ActivityEntry[] = [
      { type: 'word', original: 'test', replacement: 'nice', timestamp: Date.now() - 5000 },
    ];

    mockSendMessage.mockImplementation(
      (_msg: unknown, cb?: (response: ActivityEntry[]) => void) => {
        cb?.(entries);
        return Promise.resolve();
      },
    );

    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText('just now')).toBeInTheDocument();
    });
  });
});
