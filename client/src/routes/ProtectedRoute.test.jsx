import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as AuthContextModule from '../context/AuthContext.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

describe('ProtectedRoute Navigation Guard', () => {
  it('redirects unauthenticated user to /login', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      accessToken: null,
      loading: false,
      isAuthenticated: false
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Redirect Target</div>} />
          <Route element={<ProtectedRoute allowedRoles={['EMPLOYEE']} />}>
            <Route path="/dashboard" element={<div>Protected Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Redirect Target')).toBeInTheDocument();
      expect(screen.queryByText('Protected Secret Dashboard')).not.toBeInTheDocument();
    });
  });

  it('renders protected child component for authenticated user with valid role', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { name: 'Priya', role: 'EMPLOYEE' },
      accessToken: 'valid-test-access-token',
      loading: false,
      isAuthenticated: true
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Redirect Target</div>} />
          <Route element={<ProtectedRoute allowedRoles={['EMPLOYEE']} />}>
            <Route path="/dashboard" element={<div>Protected Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Secret Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Login Page Redirect Target')).not.toBeInTheDocument();
    });
  });
});
