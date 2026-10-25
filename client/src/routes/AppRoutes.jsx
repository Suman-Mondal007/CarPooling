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
import FindRidePage from '../pages/employee/FindRidePage.jsx';
import AvailableRidesPage from '../pages/employee/AvailableRidesPage.jsx';
import RideDetailsPage from '../pages/employee/RideDetailsPage.jsx';
import BookingConfirmationPage from '../pages/employee/BookingConfirmationPage.jsx';
import OfferRidePage from '../pages/employee/OfferRidePage.jsx';
import RouteConfirmationPage from '../pages/employee/RouteConfirmationPage.jsx';
import VehiclesPage from '../pages/employee/VehiclesPage.jsx';
import SavedPlacesPage from '../pages/employee/SavedPlacesPage.jsx';
import MyTripsPage from '../pages/employee/MyTripsPage.jsx';
import TripDetailsPage from '../pages/employee/TripDetailsPage.jsx';
import TripTrackingPage from '../pages/employee/TripTrackingPage.jsx';
import PaymentPage from '../pages/employee/PaymentPage.jsx';
import ReceiptPage from '../pages/employee/ReceiptPage.jsx';
import WalletPage from '../pages/employee/WalletPage.jsx';
import SettingsPage from '../pages/employee/SettingsPage.jsx';
import ChatPage from '../pages/employee/ChatPage.jsx';
import NotificationsPage from '../pages/employee/NotificationsPage.jsx';
import RideHistoryPage from '../pages/employee/RideHistoryPage.jsx';
import EmployeeReportsPage from '../pages/employee/EmployeeReportsPage.jsx';
import HelpSupportPage from '../pages/employee/HelpSupportPage.jsx';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';
import AdminEmployeesPage from '../pages/admin/AdminEmployeesPage.jsx';
import AdminVehiclesPage from '../pages/admin/AdminVehiclesPage.jsx';
import AdminRidesPage from '../pages/admin/AdminRidesPage.jsx';
import AdminReportsPage from '../pages/admin/AdminReportsPage.jsx';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage.jsx';

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
          <Route path="/find-ride" element={<FindRidePage />} />
          <Route path="/find-ride/confirm-route" element={<RouteConfirmationPage mode="find" />} />
          <Route path="/rides" element={<AvailableRidesPage />} />
          <Route path="/rides/:id" element={<RideDetailsPage />} />
          <Route path="/booking-confirmation/:bookingId" element={<BookingConfirmationPage />} />
          <Route path="/offer-ride" element={<OfferRidePage />} />
          <Route path="/offer-ride/confirm-route" element={<RouteConfirmationPage mode="offer" />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/my-trips" element={<MyTripsPage />} />
          <Route path="/trips/:id" element={<TripDetailsPage />} />
          <Route path="/trips/:id/tracking" element={<TripTrackingPage />} />
          <Route path="/trips/:id/pay" element={<PaymentPage />} />
          <Route path="/payments/:id/receipt" element={<ReceiptPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/history" element={<RideHistoryPage />} />
          <Route path="/saved-places" element={<SavedPlacesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<EmployeeReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpSupportPage />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['COMPANY_ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/employees" element={<AdminEmployeesPage />} />
          <Route path="/admin/vehicles" element={<AdminVehiclesPage />} />
          <Route path="/admin/rides" element={<AdminRidesPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
