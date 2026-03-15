import { render, screen, fireEvent } from '@testing-library/preact';
import CollapsibleSection from '../../src/popup/components/CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders collapsed when defaultOpen is false', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={false}>
        <p>Hidden content</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Test Section/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Content region should have max-height 0
    const region = screen.getByRole('region');
    expect(region.style.maxHeight).toBe('0px');
    expect(region.style.opacity).toBe('0');
  });

  it('renders expanded when defaultOpen is true', () => {
    render(
      <CollapsibleSection title="Open Section" defaultOpen={true}>
        <p>Visible content</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Open Section/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const region = screen.getByRole('region');
    expect(region.style.opacity).toBe('1');
  });

  it('expands on click when collapsed', () => {
    render(
      <CollapsibleSection title="Click Me" defaultOpen={false}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Click Me/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region');
    expect(region.style.opacity).toBe('1');
  });

  it('collapses on click when expanded', () => {
    render(
      <CollapsibleSection title="Collapse Me" defaultOpen={true}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Collapse Me/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const region = screen.getByRole('region');
    expect(region.style.opacity).toBe('0');
  });

  it('has correct ARIA attributes linking trigger and content', () => {
    render(
      <CollapsibleSection title="Aria Test" defaultOpen={false}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Aria Test/i });
    const region = screen.getByRole('region');

    expect(trigger).toHaveAttribute('aria-controls', region.id);
    expect(region).toHaveAttribute('aria-labelledby', trigger.id);
  });

  it('renders chevron that rotates when expanded', () => {
    const { container } = render(
      <CollapsibleSection title="Chevron Test" defaultOpen={false}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    // Chevron should not have rotate-90 when collapsed
    const chevron = container.querySelector('.inline-block.transition-transform');
    expect(chevron?.className).not.toContain('rotate-90');

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: /Chevron Test/i }));

    const expandedChevron = container.querySelector('.inline-block.transition-transform');
    expect(expandedChevron?.className).toContain('rotate-90');
  });

  it('renders badge when provided', () => {
    render(
      <CollapsibleSection title="Badge Test" defaultOpen={false} badge={5}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not render badge when badge is 0', () => {
    const { container } = render(
      <CollapsibleSection title="No Badge" defaultOpen={false} badge={0}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    // Badge pill should not exist
    const badge = container.querySelector('.rounded-full.bg-indigo-100');
    expect(badge).toBeNull();
  });

  it('does not render badge when badge is undefined', () => {
    const { container } = render(
      <CollapsibleSection title="No Badge" defaultOpen={false}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    const badge = container.querySelector('.rounded-full.bg-indigo-100');
    expect(badge).toBeNull();
  });
});
