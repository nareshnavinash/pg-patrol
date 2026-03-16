import { render, screen, waitFor, act } from '@testing-library/preact';
import StatsCard from '../../src/popup/components/StatsCard';

describe('StatsCard', () => {
  const mockTabsQuery = chrome.tabs.query as jest.Mock;
  const mockRuntimeSendMessage = chrome.runtime.sendMessage as jest.Mock;

  let rafSpy: jest.SpyInstance;

  beforeEach(() => {
    mockTabsQuery.mockReset();
    mockTabsQuery.mockImplementation(() => Promise.resolve([]));
    mockRuntimeSendMessage.mockReset();
    mockRuntimeSendMessage.mockImplementation(() => Promise.resolve());

    // Mock requestAnimationFrame to immediately invoke callback with a timestamp
    // far enough in the future that the animation completes in one frame
    rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now() + 1000);
        return 0;
      });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  it('renders "Stats" heading', () => {
    render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={0} />);
    expect(screen.getByText('Stats')).toBeInTheDocument();
  });

  it('shows EmptyState when all values are zero', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={0} />);
    });

    // EmptyState for stats renders "All clean! Browse a page to start"
    expect(screen.getByText('All clean! Browse a page to start')).toBeInTheDocument();
  });

  it('renders stat values when totalWordsReplaced is non-zero', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={42} totalImagesReplaced={0} />);
    });

    // The animated count should reach the target (42)
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('renders stat values when totalImagesReplaced is non-zero', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={10} />);
    });

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('renders all stat labels when non-zero', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={5} totalImagesReplaced={3} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Words (this page)')).toBeInTheDocument();
      expect(screen.getByText('Words (all time)')).toBeInTheDocument();
      expect(screen.getByText('Images (this page)')).toBeInTheDocument();
      expect(screen.getByText('Images (all time)')).toBeInTheDocument();
    });
  });

  it('handles chrome.runtime.sendMessage response with page stats', async () => {
    mockTabsQuery.mockImplementation(() => Promise.resolve([{ id: 42 }]));
    mockRuntimeSendMessage.mockImplementation(() =>
      Promise.resolve({ wordsReplaced: 7, imagesReplaced: 3 }),
    );

    await act(async () => {
      render(<StatsCard totalWordsReplaced={100} totalImagesReplaced={50} />);
    });

    await waitFor(() => {
      // Page-level stats should show animated counts for 7 words and 3 images
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('handles chrome.runtime.sendMessage returning null', async () => {
    mockTabsQuery.mockImplementation(() => Promise.resolve([{ id: 42 }]));
    mockRuntimeSendMessage.mockImplementation(() => Promise.resolve(null));

    await act(async () => {
      render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={0} />);
    });

    // Should still render without error, showing empty state
    expect(screen.getByText('All clean! Browse a page to start')).toBeInTheDocument();
  });

  it('handles chrome.runtime.sendMessage rejection gracefully', async () => {
    mockTabsQuery.mockImplementation(() => Promise.resolve([{ id: 42 }]));
    mockRuntimeSendMessage.mockImplementation(() => Promise.reject(new Error('no listener')));

    await act(async () => {
      render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={0} />);
    });

    // Should still render without error
    expect(screen.getByText('Stats')).toBeInTheDocument();
  });

  it('handles tabs.query returning no tabs', async () => {
    mockTabsQuery.mockImplementation(() => Promise.resolve([]));

    await act(async () => {
      render(<StatsCard totalWordsReplaced={5} totalImagesReplaced={0} />);
    });

    // runtime.sendMessage should not have been called since no tab was found
    expect(mockRuntimeSendMessage).not.toHaveBeenCalled();
  });

  it('useCountUp reaches target value when target > 0', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={25} totalImagesReplaced={0} />);
    });

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('useCountUp displays 0 when target is 0', async () => {
    await act(async () => {
      render(<StatsCard totalWordsReplaced={0} totalImagesReplaced={0} />);
    });

    // All zero means EmptyState, but the component internally sets value to 0
    // We verify the empty state is shown (which confirms counts are zero)
    expect(screen.getByText('All clean! Browse a page to start')).toBeInTheDocument();
  });
});
