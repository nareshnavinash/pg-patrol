import { render, screen, fireEvent, waitFor, act } from '@testing-library/preact';
import RevealToggle from '../../src/popup/components/RevealToggle';
import { MessageType } from '../../src/shared/types';

beforeEach(() => {
  jest.clearAllMocks();
  (chrome.tabs as any).reload = jest.fn();
  (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
  (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({});
});

describe('RevealToggle', () => {
  it('renders "Reveal original content" button', async () => {
    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText('Reveal original content')).toBeInTheDocument();
    });
  });

  it('clicking toggles to paused state and reloads tab', async () => {
    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText('Reveal original content')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Reveal original content'));
    });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: MessageType.TOGGLE_FILTERING,
      data: { enabled: false },
    });
    expect((chrome.tabs as any).reload).toHaveBeenCalledWith(1);
    expect(screen.getByText(/Filtering paused/)).toBeInTheDocument();
  });

  it('shows paused state when filteringPaused response is true', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      filteringPaused: true,
    });

    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText(/Filtering paused/)).toBeInTheDocument();
    });
  });

  it('clicking paused button resumes filtering', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      filteringPaused: true,
    });

    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText(/Filtering paused/)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Filtering paused/));
    });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: MessageType.TOGGLE_FILTERING,
      data: { enabled: true },
    });
  });

  it('handles no tab id gracefully', async () => {
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{}]);
    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText('Reveal original content')).toBeInTheDocument();
    });
  });

  it('handles sendMessage error on mount', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockRejectedValue(new Error('No content script'));
    render(<RevealToggle />);
    await waitFor(() => {
      expect(screen.getByText('Reveal original content')).toBeInTheDocument();
    });
  });
});
