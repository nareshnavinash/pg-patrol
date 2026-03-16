import { render, screen, fireEvent } from '@testing-library/preact';
import CustomWords from '../../src/popup/components/CustomWords';
import type { PGPatrolSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

function makeSettings(overrides: Partial<PGPatrolSettings> = {}): PGPatrolSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('CustomWords', () => {
  let onUpdate: jest.Mock;
  let showToast: jest.Mock;

  beforeEach(() => {
    onUpdate = jest.fn();
    showToast = jest.fn();
  });

  it('renders with blocked category active by default', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    // The "Blocked (0)" button should have the active (red) style
    const blockedBtn = screen.getByText(/^Blocked/);
    expect(blockedBtn.className).toContain('bg-red-600');
  });

  it('shows "No custom words yet" empty state when empty', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    // EmptyState for words renders "Add your first word above"
    expect(screen.getByText('Add your first word above')).toBeInTheDocument();
  });

  it('typing and clicking Add adds a blocked word', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...');
    fireEvent.input(input, { target: { value: 'badword' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    expect(onUpdate).toHaveBeenCalledWith({ customBlockedWords: ['badword'] });
    expect(showToast).toHaveBeenCalledWith('Added "badword" to blocked words');
  });

  it('pressing Enter adds a word', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...');
    fireEvent.input(input, { target: { value: 'curse' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith({ customBlockedWords: ['curse'] });
    expect(showToast).toHaveBeenCalledWith('Added "curse" to blocked words');
  });

  it('clicking chip remove button removes the word', () => {
    render(
      <CustomWords
        settings={makeSettings({ customBlockedWords: ['darn', 'heck'] })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    // Find the remove button for "darn" via aria-label
    const removeBtn = screen.getByLabelText('Remove darn');
    fireEvent.click(removeBtn);

    expect(onUpdate).toHaveBeenCalledWith({ customBlockedWords: ['heck'] });
    expect(showToast).toHaveBeenCalledWith('Removed "darn" from blocked words');
  });

  it('empty input does not add a word', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('whitespace-only input does not add a word', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...');
    fireEvent.input(input, { target: { value: '   ' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('duplicate word does not get added', () => {
    render(
      <CustomWords
        settings={makeSettings({ customBlockedWords: ['badword'] })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const input = screen.getByPlaceholderText('Add blocked word...');
    fireEvent.input(input, { target: { value: 'badword' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('switching to "safe" category shows safe words', () => {
    render(
      <CustomWords
        settings={makeSettings({ customSafeWords: ['goodword'] })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    // Click the Safe category button
    const safeBtn = screen.getByText(/^Safe/);
    fireEvent.click(safeBtn);

    // Should now show the safe word chip
    expect(screen.getByText('goodword')).toBeInTheDocument();
  });

  it('switching to safe category and adding a word updates customSafeWords', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    // Switch to safe category
    const safeBtn = screen.getByText(/^Safe/);
    fireEvent.click(safeBtn);

    const input = screen.getByPlaceholderText('Add safe word...');
    fireEvent.input(input, { target: { value: 'nice' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    expect(onUpdate).toHaveBeenCalledWith({ customSafeWords: ['nice'] });
    expect(showToast).toHaveBeenCalledWith('Added "nice" to safe words');
  });

  it('showToast is called when removing a safe word', () => {
    render(
      <CustomWords
        settings={makeSettings({ customSafeWords: ['friendly'] })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    // Switch to safe category
    const safeBtn = screen.getByText(/^Safe/);
    fireEvent.click(safeBtn);

    const removeBtn = screen.getByLabelText('Remove friendly');
    fireEvent.click(removeBtn);

    expect(onUpdate).toHaveBeenCalledWith({ customSafeWords: [] });
    expect(showToast).toHaveBeenCalledWith('Removed "friendly" from safe words');
  });

  it('renders word count in heading when words exist', () => {
    render(
      <CustomWords
        settings={makeSettings({ customBlockedWords: ['a', 'b'], customSafeWords: ['c'] })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    // Total custom words badge shows (3)
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('input is cleared after adding a word', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'badword' } });
    fireEvent.click(screen.getByText('Add'));

    // Input should be cleared
    expect(input.value).toBe('');
  });

  it('word is lowercased when added', () => {
    render(<CustomWords settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...');
    fireEvent.input(input, { target: { value: 'BadWord' } });
    fireEvent.click(screen.getByText('Add'));

    expect(onUpdate).toHaveBeenCalledWith({ customBlockedWords: ['badword'] });
  });
});
