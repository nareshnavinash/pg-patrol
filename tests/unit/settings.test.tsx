import { render, screen, fireEvent } from '@testing-library/preact';
import Settings from '../../src/popup/components/Settings';
import type { PGPatrolSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

function makeSettings(overrides: Partial<PGPatrolSettings> = {}): PGPatrolSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('Settings', () => {
  let onUpdate: jest.Mock;
  let showToast: jest.Mock;

  beforeEach(() => {
    onUpdate = jest.fn();
    showToast = jest.fn();
  });

  it('renders all toggle labels', () => {
    render(<Settings settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText('18+ Word Filter')).toBeInTheDocument();
    expect(screen.getByText('Good Vibes Mode')).toBeInTheDocument();
    expect(screen.getByText('Image Filtering')).toBeInTheDocument();
    expect(screen.getByText('AI-Enhanced Detection')).toBeInTheDocument();
    expect(screen.getByText('Developer Mode')).toBeInTheDocument();
  });

  it('renders sensitivity buttons', () => {
    render(<Settings settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Strict')).toBeInTheDocument();
  });

  it('renders NSFW Threshold slider', () => {
    render(<Settings settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText('NSFW Threshold')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  // Toggle click tests
  it('clicking text filter toggle calls onUpdate with textFilterEnabled', () => {
    render(
      <Settings
        settings={makeSettings({ textFilterEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    // The Settings component renders 5 toggles; find them by role="switch"
    const switches = screen.getAllByRole('switch');
    // First toggle: 18+ Word Filter
    fireEvent.click(switches[0]);
    expect(onUpdate).toHaveBeenCalledWith({ textFilterEnabled: false });
  });

  it('clicking positive mode toggle calls onUpdate with positiveModeEnabled', () => {
    render(
      <Settings
        settings={makeSettings({ positiveModeEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    // Second toggle: Good Vibes Mode
    fireEvent.click(switches[1]);
    expect(onUpdate).toHaveBeenCalledWith({ positiveModeEnabled: false });
  });

  it('clicking image filter toggle calls onUpdate with imageFilterEnabled', () => {
    render(
      <Settings
        settings={makeSettings({ imageFilterEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    // Third toggle: Image Filtering
    fireEvent.click(switches[2]);
    expect(onUpdate).toHaveBeenCalledWith({ imageFilterEnabled: false });
  });

  it('clicking ML toggle calls onUpdate with mlClassifierEnabled', () => {
    render(
      <Settings
        settings={makeSettings({ mlClassifierEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    // Fourth toggle: AI-Enhanced Detection
    fireEvent.click(switches[3]);
    expect(onUpdate).toHaveBeenCalledWith({ mlClassifierEnabled: false });
  });

  it('clicking developer mode toggle calls onUpdate with developerMode', () => {
    render(
      <Settings
        settings={makeSettings({ developerMode: false })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    // Fifth toggle: Developer Mode
    fireEvent.click(switches[4]);
    expect(onUpdate).toHaveBeenCalledWith({ developerMode: true });
  });

  // Sensitivity buttons
  it('clicking Mild sensitivity button calls onUpdate with sensitivity and customThreshold: null', () => {
    render(
      <Settings
        settings={makeSettings({ sensitivity: 'strict' })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Mild'));
    expect(onUpdate).toHaveBeenCalledWith({ sensitivity: 'mild', customThreshold: null });
  });

  it('clicking Moderate sensitivity button calls onUpdate with sensitivity and customThreshold: null', () => {
    render(
      <Settings
        settings={makeSettings({ sensitivity: 'strict' })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Moderate'));
    expect(onUpdate).toHaveBeenCalledWith({ sensitivity: 'moderate', customThreshold: null });
  });

  it('clicking Strict sensitivity button calls onUpdate with sensitivity and customThreshold: null', () => {
    render(
      <Settings
        settings={makeSettings({ sensitivity: 'mild' })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Strict'));
    expect(onUpdate).toHaveBeenCalledWith({ sensitivity: 'strict', customThreshold: null });
  });

  // Slider
  it('moving slider calls onUpdate with customThreshold', () => {
    render(<Settings settings={makeSettings()} onUpdate={onUpdate} showToast={showToast} />);

    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '0.50' } });
    expect(onUpdate).toHaveBeenCalledWith({ customThreshold: 0.5 });
  });

  // Reset to default
  it('"Reset to default" button appears when customThreshold is not null', () => {
    render(
      <Settings
        settings={makeSettings({ customThreshold: 0.5 })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Reset to default')).toBeInTheDocument();
  });

  it('"Reset to default" button does not appear when customThreshold is null', () => {
    render(
      <Settings
        settings={makeSettings({ customThreshold: null })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    expect(screen.queryByText('Reset to default')).not.toBeInTheDocument();
  });

  it('clicking "Reset to default" calls onUpdate with customThreshold: null', () => {
    render(
      <Settings
        settings={makeSettings({ customThreshold: 0.7 })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Reset to default'));
    expect(onUpdate).toHaveBeenCalledWith({ customThreshold: null });
  });

  it('clicking "Reset to default" calls showToast', () => {
    render(
      <Settings
        settings={makeSettings({ customThreshold: 0.7 })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Reset to default'));
    expect(showToast).toHaveBeenCalledWith('Threshold reset to default (0.15)');
  });

  // showToast on toggle changes
  it('showToast is called when text filter toggle is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ textFilterEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(showToast).toHaveBeenCalledWith('Word filter disabled');
  });

  it('showToast is called when enabling text filter', () => {
    render(
      <Settings
        settings={makeSettings({ textFilterEnabled: false })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(showToast).toHaveBeenCalledWith('Word filter enabled');
  });

  it('showToast is called when positive mode toggle is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ positiveModeEnabled: true })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);
    expect(showToast).toHaveBeenCalledWith('Good Vibes Mode disabled');
  });

  it('showToast is called when image filter toggle is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ imageFilterEnabled: false })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[2]);
    expect(showToast).toHaveBeenCalledWith('Image filtering enabled');
  });

  it('showToast is called when ML toggle is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ mlClassifierEnabled: false })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[3]);
    expect(showToast).toHaveBeenCalledWith('AI detection enabled');
  });

  it('showToast is called when developer mode toggle is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ developerMode: false })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[4]);
    expect(showToast).toHaveBeenCalledWith('Developer mode enabled');
  });

  it('showToast is called when sensitivity button is clicked', () => {
    render(
      <Settings
        settings={makeSettings({ sensitivity: 'strict' })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('Mild'));
    expect(showToast).toHaveBeenCalledWith('Sensitivity set to Mild');
  });

  // Description text
  it('shows custom threshold description when customThreshold is set', () => {
    render(
      <Settings
        settings={makeSettings({ customThreshold: 0.45 })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Custom threshold: 0.45')).toBeInTheDocument();
  });

  it('shows sensitivity description when customThreshold is null', () => {
    render(
      <Settings
        settings={makeSettings({ sensitivity: 'moderate', customThreshold: null })}
        onUpdate={onUpdate}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Standard profanity (recommended)')).toBeInTheDocument();
  });
});
