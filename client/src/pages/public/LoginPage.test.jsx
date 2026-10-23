import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext.jsx';
import LoginPage from './LoginPage.jsx';

// Mock authApi
vi.mock('../../api/auth.api.js', () => ({
  default: {
    login: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error('No session'))
  }
}));

describe('LoginPage Form Validation', () => {
  it('renders login form elements properly', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for splash screen / loading to clear
    await waitFor(() => {
      expect(screen.getByText('Sign In to Your Account')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays validation errors on invalid submission', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sign In to Your Account')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    const emailInput = screen.getByLabelText(/work email/i);

    // Enter invalid email and submit
    await user.type(emailInput, 'invalid-email');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid work email/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
});
