/**
 * Tests for the UI/UX overhaul components.
 */
import { render, screen, fireEvent } from '@testing-library/preact';
import Chip from '../../src/popup/components/Chip';
import EmptyState from '../../src/popup/components/EmptyState';
import Toast from '../../src/popup/components/Toast';
import Header from '../../src/popup/components/Header';
import Settings from '../../src/popup/components/Settings';
import CustomWords from '../../src/popup/components/CustomWords';
import SiteManager from '../../src/popup/components/SiteManager';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

// ---- Chip ----

describe('Chip', () => {
  it('renders label and remove button', () => {
    const onRemove = jest.fn();
    render(<Chip label="hello" color="red" onRemove={onRemove} />);

    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByLabelText('Remove hello')).toBeTruthy();
  });

  it('calls onRemove when × is clicked', () => {
    const onRemove = jest.fn();
    render(<Chip label="test" color="green" onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText('Remove test'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders with red color classes', () => {
    const { container } = render(<Chip label="word" color="red" onRemove={jest.fn()} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('bg-red-100');
  });

  it('renders with green color classes', () => {
    const { container } = render(<Chip label="word" color="green" onRemove={jest.fn()} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('bg-green-100');
  });

  it('renders with amber color classes', () => {
    const { container } = render(<Chip label="site" color="amber" onRemove={jest.fn()} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('bg-amber-100');
  });
});

// ---- EmptyState ----

describe('EmptyState', () => {
  it('renders stats empty state', () => {
    render(<EmptyState type="stats" />);
    expect(screen.getByText('All clean! Browse a page to start')).toBeTruthy();
  });

  it('renders words empty state', () => {
    render(<EmptyState type="words" />);
    expect(screen.getByText('Add your first word above')).toBeTruthy();
  });
});

// ---- Toast ----

describe('Toast', () => {
  it('renders with aria role="status"', () => {
    render(<Toast toast={{ message: 'Saved!', visible: true }} />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('Saved!');
  });

  it('has opacity-100 when visible', () => {
    render(<Toast toast={{ message: 'Hello', visible: true }} />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('opacity-100');
  });

  it('has opacity-0 when not visible', () => {
    render(<Toast toast={{ message: 'Hello', visible: false }} />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('opacity-0');
  });

  it('renders nothing when message is empty', () => {
    const { container } = render(<Toast toast={{ message: '', visible: false }} />);
    expect(container.innerHTML).toBe('');
  });
});

// ---- Header shield icon ----

describe('Header shield icon', () => {
  it('has shield-pulse class when enabled', () => {
    const { container } = render(<Header enabled={true} onToggle={jest.fn()} />);
    const shieldDiv = container.querySelector('.shield-pulse');
    expect(shieldDiv).not.toBeNull();
  });

  it('does not have shield-pulse class when disabled', () => {
    const { container } = render(<Header enabled={false} onToggle={jest.fn()} />);
    const shieldDiv = container.querySelector('.shield-pulse');
    expect(shieldDiv).toBeNull();
  });

  it('renders SVG shield icon', () => {
    const { container } = render(<Header enabled={true} onToggle={jest.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

// ---- Settings sensitivity bar ----

describe('Settings sensitivity bar', () => {
  it('renders three bar segments', () => {
    const { container } = render(<Settings settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);
    // Default is moderate — should have green, yellow, gray
    const bars = container.querySelectorAll('.h-1.rounded-full');
    expect(bars.length).toBe(3);
  });

  it('calls showToast on sensitivity change', () => {
    const showToast = jest.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} showToast={showToast} />);

    fireEvent.click(screen.getByText('Strict'));
    expect(showToast).toHaveBeenCalledWith('Sensitivity set to Strict');
  });

  it('calls showToast on toggle change', () => {
    const showToast = jest.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} showToast={showToast} />);

    // Click the first switch (18+ Word Filter) - it's enabled by default, so toggling disables it
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(showToast).toHaveBeenCalled();
  });
});

// ---- CustomWords with chips ----

describe('CustomWords chips', () => {
  it('renders words as chips', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      customBlockedWords: ['bad', 'worse'],
    };
    render(<CustomWords settings={settings} onUpdate={jest.fn()} />);

    expect(screen.getByText('bad')).toBeTruthy();
    expect(screen.getByText('worse')).toBeTruthy();
    expect(screen.getByLabelText('Remove bad')).toBeTruthy();
  });

  it('shows empty state when no words', () => {
    render(<CustomWords settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />);
    expect(screen.getByText('Add your first word above')).toBeTruthy();
  });

  it('calls showToast when adding a word', () => {
    const showToast = jest.fn();
    render(<CustomWords settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} showToast={showToast} />);

    const input = screen.getByPlaceholderText('Add blocked word...') as HTMLInputElement;
    input.value = 'newword';
    fireEvent.input(input, { target: { value: 'newword' } });
    fireEvent.click(screen.getByText('Add'));

    expect(showToast).toHaveBeenCalledWith('Added "newword" to blocked words');
  });
});

// ---- SiteManager with chips ----

describe('SiteManager chips', () => {
  it('renders whitelisted sites as amber chips', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      whitelistedSites: ['example.com', 'test.org'],
    };
    render(<SiteManager hostname="other.com" settings={settings} onUpdate={jest.fn()} />);

    expect(screen.getByText('example.com')).toBeTruthy();
    expect(screen.getByText('test.org')).toBeTruthy();
    expect(screen.getByLabelText('Remove example.com')).toBeTruthy();
  });

  it('calls showToast when toggling whitelist', () => {
    const showToast = jest.fn();
    render(
      <SiteManager
        hostname="example.com"
        settings={DEFAULT_SETTINGS}
        onUpdate={jest.fn()}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Whitelist'));
    expect(showToast).toHaveBeenCalledWith('Whitelisted example.com');
  });

  it('current hostname shown as pill', () => {
    const { container } = render(
      <SiteManager hostname="example.com" settings={DEFAULT_SETTINGS} onUpdate={jest.fn()} />,
    );

    const pill = container.querySelector('.rounded-full');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('example.com');
  });
});
