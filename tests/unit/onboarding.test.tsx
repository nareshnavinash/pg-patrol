import { render, screen, fireEvent } from '@testing-library/preact';
import Onboarding from '../../src/popup/components/Onboarding';

describe('Onboarding', () => {
  it('renders the welcome step first', () => {
    render(<Onboarding onComplete={jest.fn()} />);
    expect(screen.getByText('Welcome to PG Patrol')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    // No Back button on first step
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows 3 progress dots', () => {
    render(<Onboarding onComplete={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    // First dot is selected
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('navigates to step 2 on Next click', () => {
    render(<Onboarding onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText('Replaces swear words')).toBeInTheDocument();
    expect(screen.getByText('Detects NSFW images')).toBeInTheDocument();
    expect(screen.getByText('Hides distressing news')).toBeInTheDocument();
    // Back button should now appear
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('navigates to step 3 with sensitivity picker', () => {
    render(<Onboarding onComplete={jest.fn()} />);
    // Go to step 2
    fireEvent.click(screen.getByText('Next'));
    // Go to step 3
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Choose your level')).toBeInTheDocument();
    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Strict')).toBeInTheDocument();
    expect(screen.getByText('Start browsing safely')).toBeInTheDocument();
  });

  it('navigates back to previous step', () => {
    render(<Onboarding onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('How it works')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Welcome to PG Patrol')).toBeInTheDocument();
  });

  it('calls onComplete with selected sensitivity on final step', () => {
    const onComplete = jest.fn();
    render(<Onboarding onComplete={onComplete} />);

    // Navigate to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    // Default is strict, change to moderate
    fireEvent.click(screen.getByText('Moderate'));

    // Complete
    fireEvent.click(screen.getByText('Start browsing safely'));
    expect(onComplete).toHaveBeenCalledWith('moderate');
  });

  it('defaults to strict sensitivity', () => {
    const onComplete = jest.fn();
    render(<Onboarding onComplete={onComplete} />);

    // Navigate to final step and complete without changing sensitivity
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Start browsing safely'));
    expect(onComplete).toHaveBeenCalledWith('strict');
  });

  it('highlights the selected sensitivity option', () => {
    render(<Onboarding onComplete={jest.fn()} />);

    // Navigate to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    // Strict is selected by default
    const strictButton = screen.getByText('Strict').closest('button');
    expect(strictButton?.className).toContain('border-indigo-500');

    // Select mild
    fireEvent.click(screen.getByText('Mild'));
    const mildButton = screen.getByText('Mild').closest('button');
    expect(mildButton?.className).toContain('border-indigo-500');
  });
});
