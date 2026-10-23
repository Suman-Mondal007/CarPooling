import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Layouts
import PublicLayout from '../layouts/PublicLayout.jsx';
import EmployeeLayout from '../layouts/EmployeeLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

// Public Pages
import LandingPage from '../pages/public/LandingPage.jsx';
import LoginPage from '../pages/public/LoginPage.jsx';
import RegisterPage from '../pages/public/RegisterPage.jsx';
import ForgotPasswordPage from '../pages/public/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../pages/public/ResetPasswordPage.jsx';
import NotFoundPage from '../pages/public/NotFoundPage.jsx';

// Employee Pages
import DashboardPage from '../pages/employee/DashboardPage.jsx';
import ProfilePage from '../pages/employee/ProfilePage.jsx';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';

// Placeholder Component for future phases
import PlaceholderPage from '../pages/PlaceholderPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Protected Employee Routes */}
      <Route element={<ProtectedRoute allowedRoles={['EMPLOYEE', 'COMPANY_ADMIN']} />}>
        <Route element={<EmployeeLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/find-ride" element={<PlaceholderPage title="Find a Ride" phase="Phase 4" description="Interactive ride search with map routing and instant seat booking will be available here." />} />
          <Route path="/find-ride/confirm-route" element={<PlaceholderPage title="Route Confirmation" phase="Phase 4" />} />
          <Route path="/rides" element={<PlaceholderPage title="Available Rides" phase="Phase 4" />} />
          <Route path="/rides/:id" element={<PlaceholderPage title="Ride Details" phase="Phase 4" />} />
          <Route path="/booking-confirmation/:bookingId" element={<PlaceholderPage title="Booking Confirmation" phase="Phase 4" />} />
          <Route path="/offer-ride" element={<PlaceholderPage title="Offer a Ride" phase="Phase 3" description="Vehicle selection, route configuration, and scheduled seat publishing will be available here." />} />
          <Route path="/offer-ride/confirm-route" element={<PlaceholderPage title="Route Confirmation" phase="Phase 3" />} />
          <Route path="/vehicles" element={<PlaceholderPage title="My Vehicles" phase="Phase 3" description="Manage your registered personal vehicles and review company admin verification status." />} />
          <Route path="/my-trips" element={<PlaceholderPage title="My Trips" phase="Phase 4" description="Manage your scheduled passenger bookings and offered driver journeys." />} />
          <Route path="/trips/:id" element={<PlaceholderPage title="Trip Details" phase="Phase 4" />} />
          <Route path="/trips/:id/tracking" element={<PlaceholderPage title="Live Trip Tracking" phase="Phase 5" description="Real-time vehicle map tracking with WebSockets and dynamic ETA." />} />
          <Route path="/trips/:id/pay" element={<PlaceholderPage title="Trip Payment" phase="Phase 6" description="Sandbox payment checkout via Razorpay card, UPI, cash, and digital wallet." />} />
          <Route path="/wallet" element={<PlaceholderPage title="Digital Wallet" phase="Phase 6" description="Internal wallet ledger with simulated recharge and fare settlement." />} />
          <Route path="/history" element={<PlaceholderPage title="Ride History" phase="Phase 7" description="Historical log of completed trips with search and filtering." />} />
          <Route path="/saved-places" element={<PlaceholderPage title="Saved Places" phase="Phase 3" description="Manage frequently used home, office, and route addresses." />} />
          <Route path="/chat" element={<PlaceholderPage title="Trip Chat" phase="Phase 5" description="Real-time trip messaging between verified drivers and co-passengers." />} />
          <Route path="/notifications" element={<PlaceholderPage title="Notifications" phase="Phase 5" description="Notification feed for bookings, journey progress, and payments." />} />
          <Route path="/reports" element={<PlaceholderPage title="Commute Reports" phase="Phase 7" description="Personalized travel statistics, cost savings, and fuel efficiency metrics." />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<PlaceholderPage title="Account Settings" phase="Phase 7" />} />
          <Route path="/help" element={<PlaceholderPage title="Help & Support" phase="Phase 7" />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['COMPANY_ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/employees" element={<PlaceholderPage title="Employee Administration" phase="Phase 7" description="Approve, suspend, and deactivate organization employees." />} />
          <Route path="/admin/vehicles" element={<PlaceholderPage title="Vehicle Verification" phase="Phase 7" description="Inspect and verify employee vehicles before rides can be offered." />} />
          <Route path="/admin/rides" element={<PlaceholderPage title="Ride Monitoring" phase="Phase 7" description="Read-only monitoring of all current and scheduled organization rides." />} />
          <Route path="/admin/reports" element={<PlaceholderPage title="Organization Reports" phase="Phase 7" description="Aggregated fuel consumption, cost per km, and employee participation analytics." />} />
          <Route path="/admin/settings" element={<PlaceholderPage title="Organization Settings" phase="Phase 7" description="Configure fuel prices, cancellation cutoffs, and registration codes." />} />
        </Route>
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
