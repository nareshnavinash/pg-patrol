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
});
