import { render, screen, waitFor } from '@testing-library/preact';
import App from '../../src/popup/App';

describe('App', () => {
  it('shows loading state initially', () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the PG Patrol title after loading', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol')).toBeInTheDocument();
    });
  });

  it('renders the version', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PG Patrol v1.0.0')).toBeInTheDocument();
    });
  });
});
