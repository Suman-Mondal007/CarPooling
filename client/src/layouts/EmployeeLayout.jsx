import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Car,
  Compass,
  PlusCircle,
  Calendar,
  Wallet,
  History,
  MessageSquare,
  Bell,
  BarChart2,
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bookmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import Badge from '../components/common/Badge.jsx';

export function EmployeeLayout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { status: socketStatus } = useSocket();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Compass },
    { to: '/find-ride', label: 'Find a Ride', icon: Car },
    { to: '/offer-ride', label: 'Offer a Ride', icon: PlusCircle },
    { to: '/my-trips', label: 'My Trips', icon: Calendar },
    { to: '/vehicles', label: 'My Vehicles', icon: Car },
    { to: '/wallet', label: 'Wallet', icon: Wallet },
    { to: '/history', label: 'Ride History', icon: History },
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/reports', label: 'Reports', icon: BarChart2 }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                C
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 tracking-tight block">Enterprise Carpooling</span>
                <span className="text-[10px] text-teal-600 font-medium tracking-wide uppercase block -mt-1">
                  {user?.organization?.name || 'Enterprise'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navLinks.slice(0, 5).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-50 text-teal-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {/* Real-time Connection Status Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
              title={`Socket Status: ${socketStatus}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  socketStatus === 'connected'
                    ? 'bg-emerald-500'
                    : socketStatus === 'reconnecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="hidden md:inline capitalize">{socketStatus}</span>
            </div>

            {/* Notifications Button */}
            <Link
              to="/notifications"
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>


            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs uppercase">
                  {user?.name ? user.name.charAt(0) : 'U'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-slate-800 leading-tight">{user?.name || 'Employee'}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{user?.role?.toLowerCase() || 'Employee'}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <div className="mt-1">
                      <Badge variant="emerald" size="sm">Active</Badge>
                    </div>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    to="/my-trips"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>My Trips</span>
                  </Link>

                  <Link
                    to="/vehicles"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <Car className="w-4 h-4 text-slate-400" />
                    <span>My Vehicles</span>
                  </Link>

                  <Link
                    to="/saved-places"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <Bookmark className="w-4 h-4 text-slate-400" />
                    <span>Saved Places</span>
                  </Link>

                  <Link
                    to="/wallet"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <Wallet className="w-4 h-4 text-slate-400" />
                    <span>Wallet</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </Link>

                  <Link
                    to="/help"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                  >
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>Help & Support</span>
                  </Link>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center space-x-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default EmployeeLayout;
