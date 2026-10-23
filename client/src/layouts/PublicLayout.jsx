import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/common/Button.jsx';

export function PublicLayout() {
  const { isAuthenticated, isCompanyAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-xl shadow-xs group-hover:scale-105 transition-transform">
              C
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block">Enterprise Carpooling</span>
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider block -mt-1">Corporate Mobility</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-teal-600 transition-colors">How It Works</a>
            <a href="#benefits" className="hover:text-teal-600 transition-colors">Benefits</a>
            <a href="#sustainability" className="hover:text-teal-600 transition-colors">Sustainability</a>
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(isCompanyAdmin ? '/admin' : '/dashboard')}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                C
              </div>
              <span className="text-sm font-semibold text-white">Enterprise Carpooling</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Empowering registered enterprise organizations with secure, verified, and cost-effective daily employee commutes.
            </p>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/find-ride" className="hover:text-teal-400 transition-colors">Find a Ride</Link></li>
              <li><Link to="/offer-ride" className="hover:text-teal-400 transition-colors">Offer a Ride</Link></li>
              <li><Link to="/login" className="hover:text-teal-400 transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-teal-400 transition-colors">Employee Registration</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Support & Policies</h4>
            <ul className="space-y-2">
              <li><Link to="/help" className="hover:text-teal-400 transition-colors">Help & FAQ</Link></li>
              <li><a href="#terms" className="hover:text-teal-400 transition-colors">Terms of Service</a></li>
              <li><a href="#privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Corporate</h4>
            <p className="text-slate-400 leading-relaxed mb-2">
              Multi-tenant architecture. Ride sharing is restricted strictly within registered organization boundaries.
            </p>
            <p className="text-[11px] text-slate-500">
              * Note: Environmental and financial metrics in promotional materials are illustrative estimates.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-slate-800 text-center text-slate-500">
          &copy; {new Date().getFullYear()} Enterprise Carpooling Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
