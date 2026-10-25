import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RideHistoryPage from './RideHistoryPage.jsx';

vi.mock('../../api/admin.api.js', () => ({
  getHistory: vi.fn()
}));

import { getHistory } from '../../api/admin.api.js';

describe('RideHistoryPage (Phase 7 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ride history list with trip information and badges', async () => {
    getHistory.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              tripId: 'trip_123',
              role: 'driver',
              originAddress: 'Whitefield, Bengaluru',
              destinationAddress: 'Koramangala, Bengaluru',
              departureAt: '2026-03-20T08:30:00.000Z',
              distanceMeters: 18000,
              vehicleModel: 'Honda City',
              vehicleRegistration: 'KA01AB1234',
              fareMinor: 15000,
              tripStatus: 'COMPLETED',
              paymentStatus: 'PAID',
              participants: [{ name: 'Passenger Pam', seats: 1, paymentStatus: 'PAID' }]
            }
          ],
          total: 1,
          page: 1,
          limit: 10
        }
      }
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RideHistoryPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Ride History/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Whitefield, Bengaluru')[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Koramangala, Bengaluru/)[0]).toBeInTheDocument();
      expect(screen.getAllByText('KA01AB1234')[0]).toBeInTheDocument();
      expect(screen.getAllByText('150')[0]).toBeInTheDocument();
    });
  });
});
