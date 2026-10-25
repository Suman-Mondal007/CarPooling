import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentPage from './PaymentPage.jsx';

// Mock APIs
vi.mock('../../api/trips.api.js', () => ({
  tripsApi: {
    getTripById: vi.fn()
  }
}));

vi.mock('../../api/wallet.api.js', () => ({
  walletApi: {
    getWallet: vi.fn()
  }
}));

vi.mock('../../api/auth.api.js', () => ({
  authApi: {
    getProfile: vi.fn()
  }
}));

vi.mock('../../api/payments.api.js', () => ({
  paymentsApi: {
    createOrder: vi.fn(),
    walletPay: vi.fn(),
    cashPay: vi.fn(),
    getMyPayments: vi.fn().mockResolvedValue({ data: { items: [] } })
  }
}));

import { tripsApi } from '../../api/trips.api.js';
import { walletApi } from '../../api/wallet.api.js';
import { authApi } from '../../api/auth.api.js';

describe('PaymentPage (Phase 6 Frontend)', () => {
  const sampleTrip = {
    _id: 'trip_100',
    status: 'COMPLETED',
    driver: { name: 'Dan Driver', phone: '+919876543210' },
    ride: {
      originAddress: 'Koramangala, Bangalore',
      destinationAddress: 'Electronic City, Bangalore',
      farePerSeatMinor: 25000
    },
    bookings: [
      {
        _id: 'booking_100',
        passenger: 'user_penny',
        seats: 1,
        fareTotalMinor: 25000, // ₹250.00
        paymentStatus: 'UNPAID',
        status: 'COMPLETED'
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authApi.getProfile.mockResolvedValue({
      data: {
        user: {
          _id: 'user_penny',
          name: 'Penny Passenger',
          preferredPaymentMethod: 'WALLET'
        }
      }
    });
  });

  it('renders test mode banner, fare summary, and payment methods selector', async () => {
    tripsApi.getTripById.mockResolvedValue({ data: sampleTrip });
    walletApi.getWallet.mockResolvedValue({
      data: { balanceMinor: 50000, currency: 'INR' } // ₹500 (sufficient)
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/trips/trip_100/pay']}>
        <Routes>
          <Route path="/trips/:id/pay" element={<PaymentPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Test mode/i)).toBeInTheDocument();
      expect(screen.getByText(/No real money is processed/i)).toBeInTheDocument();
    });

    // Check fare amount (₹250.00)
    expect(screen.getAllByText(/250\.00/i).length).toBeGreaterThan(0);

    // Check payment methods
    expect(screen.getByText('Digital Wallet')).toBeInTheDocument();
    expect(screen.getByText('Debit / Credit Card')).toBeInTheDocument();
    expect(screen.getByText('UPI (VPA / QR)')).toBeInTheDocument();
    expect(screen.getByText('Physical Cash')).toBeInTheDocument();

    // Since balance is ₹500 (>= ₹250), wallet pay button should be enabled
    const payWalletBtn = screen.getByRole('button', { name: /Pay ₹250\.00 from Wallet/i });
    expect(payWalletBtn).toBeEnabled();

    // Switch to Card
    fireEvent.click(screen.getByText('Debit / Credit Card'));
    expect(screen.getByRole('button', { name: /Pay ₹250\.00 via CARD/i })).toBeInTheDocument();
  });

  it('displays insufficient wallet balance warning and disables wallet pay button when balance is too low', async () => {
    tripsApi.getTripById.mockResolvedValue({ data: sampleTrip });
    walletApi.getWallet.mockResolvedValue({
      data: { balanceMinor: 10000, currency: 'INR' } // ₹100 (< ₹250)
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/trips/trip_100/pay']}>
        <Routes>
          <Route path="/trips/:id/pay" element={<PaymentPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
    });

    // Warning message
    expect(screen.getByText(/You have/i)).toBeInTheDocument();
    expect(screen.getByText(/Recharge Wallet/i)).toBeInTheDocument();

    // Wallet pay button should be disabled
    const payWalletBtn = screen.getByRole('button', { name: /Pay ₹250\.00 from Wallet/i });
    expect(payWalletBtn).toBeDisabled();
  });
});
