/**
 * Tests validating the React → Preact migration.
 * Ensures all components render correctly with Preact's compat layer,
 * hooks work properly, and event handling is functional.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import Toggle from '../../src/popup/components/Toggle';
import Header from '../../src/popup/components/Header';
import Settings from '../../src/popup/components/Settings';
import StatsCard from '../../src/popup/components/StatsCard';
import SiteManager from '../../src/popup/components/SiteManager';
import RevealToggle from '../../src/popup/components/RevealToggle';
import CustomWords from '../../src/popup/components/CustomWords';
import PerspectiveSetup from '../../src/popup/components/PerspectiveSetup';
import App from '../../src/popup/App';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

describe('Preact migration — component rendering', () => {
  it('Toggle renders and responds to clicks via Preact', () => {
    const onChange = jest.fn();
    render(<Toggle enabled={false} onChange={onChange} label="Preact Toggle" />);

    expect(screen.getByText('Preact Toggle')).toBeTruthy();
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(switchEl);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Toggle shows description text', () => {
    render(
      <Toggle enabled={true} onChange={jest.fn()} label="Label" description="Some description" />,
    );
    expect(screen.getByText('Some description')).toBeTruthy();
  });

  it('Header renders title and subtitle', () => {
    render(<Header enabled={true} onToggle={jest.fn()} />);
    expect(screen.getByText('PG Patrol')).toBeTruthy();
    expect(screen.getByText('Family-friendly filter')).toBeTruthy();
  });

  it('StatsCard renders stat labels', () => {
    render(<StatsCard totalWordsReplaced={42} totalImagesReplaced={7} />);
    // Count-up animation starts from 0, so check labels instead of exact values
    expect(screen.getByText('Words (all time)')).toBeTruthy();
    expect(screen.getByText('Images (all time)')).toBeTruthy();
  });

  it('Settings renders all toggle labels', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);
    expect(screen.getByText('18+ Word Filter')).toBeTruthy();
    expect(screen.getByText('Good Vibes Mode')).toBeTruthy();
    expect(screen.getByText('Image Filtering (Research Preview)')).toBeTruthy();
  });

  it('Settings sensitivity buttons are interactive', () => {
    const onUpdate = jest.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByText('Strict'));
    expect(onUpdate).toHaveBeenCalledWith({ sensitivity: 'strict', customThreshold: null });
  });

  it('SiteManager renders hostname', () => {
    render(<SiteManager hostname="example.com" settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);
    expect(screen.getByText('example.com')).toBeTruthy();
  });

  it('SiteManager shows "No active site" when hostname is empty', () => {
    render(<SiteManager hostname="" settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);
    expect(screen.getByText('No active site')).toBeTruthy();
  });

  it('RevealToggle renders and toggles state', () => {
    render(<RevealToggle />);
    const button = screen.getByText('Reveal original content');
    expect(button).toBeTruthy();

    fireEvent.click(button);
    expect(screen.getByText('Filtering paused — Click to resume')).toBeTruthy();
  });
});

describe('Preact migration — hooks', () => {
  it('App shows loading state then renders content via useStorage hook', async () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeTruthy();
    });
  });

  it('App renders version footer', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol v1.5.0')).toBeTruthy();
    });
  });
});

describe('Preact migration — CustomWords interactions', () => {
  it('CustomWords shows category tabs (always visible)', () => {
    render(<CustomWords settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);

    // Tabs are always visible (no expand needed)
    expect(screen.getByText(/Blocked/)).toBeTruthy();
    expect(screen.getByText(/Safe/)).toBeTruthy();
  });

  it('CustomWords can add a blocked word', () => {
    const onUpdate = jest.fn();
    render(<CustomWords settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const input = screen.getByPlaceholderText('Add blocked word...') as HTMLInputElement;
    input.value = 'testword';
    fireEvent.input(input, { target: { value: 'testword' } });
    fireEvent.click(screen.getByText('Add'));

    expect(onUpdate).toHaveBeenCalledWith({
      customBlockedWords: ['testword'],
    });
  });

  it('CustomWords switches to safe words tab', () => {
    const onUpdate = jest.fn();
    render(<CustomWords settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByText(/^Safe/));

    expect(screen.getByPlaceholderText('Add safe word...')).toBeTruthy();
  });
});

describe('Preact migration — PerspectiveSetup', () => {
  it('PerspectiveSetup expands on click', () => {
    render(<PerspectiveSetup apiKey="" onSave={jest.fn()} />);

    fireEvent.click(screen.getByText(/Enhanced Detection/));
    expect(screen.getByPlaceholderText('Enter API key')).toBeTruthy();
  });

  it('PerspectiveSetup shows active status when API key is set', () => {
    render(<PerspectiveSetup apiKey="test-key-123" onSave={jest.fn()} />);

    fireEvent.click(screen.getByText(/Enhanced Detection/));
    expect(screen.getByText('Enhanced detection is active.')).toBeTruthy();
  });

  it('PerspectiveSetup save button calls onSave', () => {
    const onSave = jest.fn();
    render(<PerspectiveSetup apiKey="" onSave={onSave} />);

    fireEvent.click(screen.getByText(/Enhanced Detection/));
    const input = screen.getByPlaceholderText('Enter API key') as HTMLInputElement;
    input.value = 'my-api-key';
    fireEvent.input(input, { target: { value: 'my-api-key' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith('my-api-key');
  });
});

describe('Preact migration — SiteManager whitelist', () => {
  it('whitelist button adds site', () => {
    const onUpdate = jest.fn();
    render(<SiteManager hostname="example.com" settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByText('Whitelist'));
    expect(onUpdate).toHaveBeenCalledWith({
      whitelistedSites: ['example.com'],
    });
  });

  it('whitelisted site shows remove button', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      whitelistedSites: ['test.com'],
    };
    const onUpdate = jest.fn();
    render(<SiteManager hostname="other.com" settings={settings} onUpdate={onUpdate} />);

    expect(screen.getByText('test.com')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove test.com'));
    expect(onUpdate).toHaveBeenCalledWith({ whitelistedSites: [] });
  });
});
