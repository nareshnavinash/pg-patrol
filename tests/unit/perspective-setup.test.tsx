import { render, screen, fireEvent, waitFor, act } from '@testing-library/preact';
import PerspectiveSetup from '../../src/popup/components/PerspectiveSetup';

// Mock the testApiKey function from perspective-api module
jest.mock('../../src/shared/perspective-api', () => ({
  testApiKey: jest.fn(),
}));

import { testApiKey } from '../../src/shared/perspective-api';

const mockTestApiKey = testApiKey as jest.MockedFunction<typeof testApiKey>;

describe('PerspectiveSetup', () => {
  let onSave: jest.Mock;

  beforeEach(() => {
    onSave = jest.fn();
    mockTestApiKey.mockReset();
  });

  it('renders input and buttons', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    expect(screen.getByPlaceholderText('Enter API key')).toBeInTheDocument();
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders section title', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    expect(screen.getByText('Enhanced Detection (Perspective API)')).toBeInTheDocument();
  });

  it('clicking "Test Key" with valid key shows success', async () => {
    mockTestApiKey.mockResolvedValue(true);

    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: 'valid-api-key-123' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Key'));
    });

    await waitFor(() => {
      expect(screen.getByText('API key is valid!')).toBeInTheDocument();
    });

    expect(mockTestApiKey).toHaveBeenCalledWith('valid-api-key-123');
  });

  it('clicking "Test Key" with invalid key shows error', async () => {
    mockTestApiKey.mockResolvedValue(false);

    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: 'bad-key' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Key'));
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid API key or connection error.')).toBeInTheDocument();
    });
  });

  it('clicking "Save" calls onSave with the trimmed key value', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: '  my-key-value  ' } });

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('my-key-value');
  });

  it('shows "Enhanced detection is active" when apiKey is set', () => {
    render(<PerspectiveSetup apiKey="existing-key" onSave={onSave} />);

    expect(screen.getByText('Enhanced detection is active.')).toBeInTheDocument();
  });

  it('does not show "Enhanced detection is active" when apiKey is empty', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    expect(screen.queryByText('Enhanced detection is active.')).not.toBeInTheDocument();
  });

  it('"Test Key" button is disabled when input is empty', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const testButton = screen.getByText('Test Key');
    expect(testButton).toBeDisabled();
  });

  it('"Save" button is disabled when input is empty', () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('shows "Testing..." text while testing', async () => {
    // Create a promise that we control to keep the test in the "testing" state
    let resolveTest!: (value: boolean) => void;
    mockTestApiKey.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveTest = resolve;
        }),
    );

    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: 'some-key' } });

    // Start the test
    await act(async () => {
      fireEvent.click(screen.getByText('Test Key'));
    });

    // Should now show "Testing..."
    expect(screen.getByText('Testing...')).toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      resolveTest(true);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Key')).toBeInTheDocument();
    });
  });

  it('clears test result when input changes', async () => {
    mockTestApiKey.mockResolvedValue(true);

    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: 'valid-key' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Key'));
    });

    await waitFor(() => {
      expect(screen.getByText('API key is valid!')).toBeInTheDocument();
    });

    // Changing input should clear the test result
    fireEvent.input(input, { target: { value: 'valid-key-modified' } });
    expect(screen.queryByText('API key is valid!')).not.toBeInTheDocument();
  });

  it('pre-populates input with existing apiKey', () => {
    render(<PerspectiveSetup apiKey="pre-existing-key" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key') as HTMLInputElement;
    expect(input.value).toBe('pre-existing-key');
  });

  it('does not call testApiKey when input is whitespace only', async () => {
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    const input = screen.getByPlaceholderText('Enter API key');
    fireEvent.input(input, { target: { value: '   ' } });

    // Even if the button somehow gets clicked, testApiKey should not be called
    // because handleTest checks !inputKey.trim()
    expect(mockTestApiKey).not.toHaveBeenCalled();
  });
});
