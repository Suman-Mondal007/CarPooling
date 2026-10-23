import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

describe('App Component', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          status: 'UP',
          uptime: 10,
          database: 'connected'
        },
        error: null
      })
    });
  });

  it('renders application header and title', async () => {
    render(<App />);
    expect(screen.getByText('Enterprise Carpooling Platform')).toBeInTheDocument();
    expect(screen.getByText('Phase 1: Foundation')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument();
    });
  });

  it('fetches and displays system status', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument();
    });
  });
});
