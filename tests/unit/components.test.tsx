import { render, screen, fireEvent } from '@testing-library/preact';
import Toggle from '../../src/popup/components/Toggle';
import Header from '../../src/popup/components/Header';

describe('Toggle', () => {
  it('renders with label', () => {
    render(<Toggle enabled={true} onChange={jest.fn()} label="Test Toggle" />);
    expect(screen.getByText('Test Toggle')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Toggle
        enabled={true}
        onChange={jest.fn()}
        label="Test"
        description="A description"
      />,
    );
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('calls onChange when clicked', () => {
    const onChange = jest.fn();
    render(<Toggle enabled={false} onChange={onChange} label="Test" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('has correct aria-checked when enabled', () => {
    render(<Toggle enabled={true} onChange={jest.fn()} label="Test" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('has correct aria-checked when disabled', () => {
    render(<Toggle enabled={false} onChange={jest.fn()} label="Test" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Header', () => {
  it('renders PG Patrol title', () => {
    render(<Header enabled={true} onToggle={jest.fn()} />);
    expect(screen.getByText('PG Patrol')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<Header enabled={true} onToggle={jest.fn()} />);
    expect(screen.getByText('Family-friendly filter')).toBeInTheDocument();
  });

  it('shows feature badges when enabled', () => {
    const { container } = render(
      <Header
        enabled={true}
        onToggle={jest.fn()}
        textFilterEnabled={true}
        imageFilterEnabled={true}
        positiveModeEnabled={false}
        mlClassifierEnabled={true}
      />,
    );

    const badges = container.querySelector('[data-testid="feature-badges"]');
    expect(badges).not.toBeNull();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Vibes')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('applies active style to enabled features', () => {
    render(
      <Header
        enabled={true}
        onToggle={jest.fn()}
        textFilterEnabled={true}
        imageFilterEnabled={false}
        positiveModeEnabled={true}
        mlClassifierEnabled={false}
      />,
    );

    const textBadge = screen.getByText('Text');
    expect(textBadge.className).toContain('bg-green-100');

    const imagesBadge = screen.getByText('Images');
    expect(imagesBadge.className).toContain('bg-gray-100');

    const vibesBadge = screen.getByText('Vibes');
    expect(vibesBadge.className).toContain('bg-green-100');

    const aiBadge = screen.getByText('AI');
    expect(aiBadge.className).toContain('bg-gray-100');
  });

  it('hides feature badges when extension is disabled', () => {
    const { container } = render(
      <Header
        enabled={false}
        onToggle={jest.fn()}
        textFilterEnabled={true}
        imageFilterEnabled={true}
      />,
    );

    const badges = container.querySelector('[data-testid="feature-badges"]');
    expect(badges).toBeNull();
  });
});
