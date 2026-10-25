import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripTrackingPage from './TripTrackingPage.jsx';

// Mock Leaflet & react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="map-popup">{children}</div>,
  Polyline: () => <div data-testid="map-polyline" />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() })
}));

vi.mock('leaflet', () => ({
  default: {
    DivIcon: vi.fn()
  }
}));

// Mock contexts
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { _id: 'user_passenger', name: 'Passenger User', role: 'EMPLOYEE' }
  })
}));

vi.mock('../../hooks/useSocket.js', () => ({
  useSocket: () => ({
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    status: 'connected',
    isConnected: true
  })
}));

// Mock trips API to return tracking data with stale location (>30s)
vi.mock('../../api/trips.api.js', () => ({
  default: {
    getTripTracking: vi.fn().mockResolvedValue({
      tripId: 'trip_123',
      status: 'IN_PROGRESS',
      isDriver: false,
      lastKnownLocation: { lat: 12.9716, lng: 77.5946 },
      lastLocationAt: new Date(Date.now() - 45000).toISOString(), // 45 seconds ago
      isStale: true,
      eta: { durationMinutes: 12, distanceKm: 4.5 },
      pickup: { address: 'Origin Gate', coords: { lat: 12.97, lng: 77.59 } },
      destination: { address: 'Tech Park', coords: { lat: 12.98, lng: 77.60 } },
      driver: { name: 'Priya Sharma', phone: '+919876543210' },
      vehicle: { model: 'Honda City', registrationNumber: 'KA01AB1234' }
    })
  }
}));

// Mock ChatPanel
vi.mock('../../components/chat/ChatPanel.jsx', () => ({
  default: () => <div data-testid="mock-chat-panel" />
}));

describe('TripTrackingPage - Stale Location Warning', () => {
  it('renders stale location warning banner when lastLocationAt is older than 30 seconds', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/trips/trip_123/tracking']}>
        <Routes>
          <Route path="/trips/:id/tracking" element={<TripTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('stale-location-warning')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/driver location has not updated for over 30 seconds/i)
    ).toBeInTheDocument();
  });
});
