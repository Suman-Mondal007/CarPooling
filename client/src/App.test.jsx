import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

// Mock authApi for top-level app render
vi.mock('./api/auth.api.js', () => ({
  default: {
    refresh: vi.fn().mockRejectedValue(new Error('No existing session'))
  }
}));

describe('App Component', () => {
  it('renders application navigation and landing page hero', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/share the drive/i);
    });

    expect(screen.getAllByText(/enterprise carpooling/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText('Find a Ride')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Offer a Ride')[0]).toBeInTheDocument();
  });
});
