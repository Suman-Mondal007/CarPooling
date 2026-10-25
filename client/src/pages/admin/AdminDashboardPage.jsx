import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminSummary } from '../../api/admin.api.js';
import { Users, Car, MapPin, TrendingUp, ChevronRight, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../../components/common/Skeleton.jsx';
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSummary()
      .then((res) => setSummary(res.data?.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Pending Approvals',
      value: summary?.pendingApprovals,
      icon: Users,
      color: 'bg-amber-50 text-amber-600',
      link: '/admin/employees?status=PENDING_APPROVAL',
      linkLabel: 'Review employees'
    },
    {
      label: 'Pending Vehicles',
      value: summary?.pendingVehicles,
      icon: Car,
      color: 'bg-blue-50 text-blue-600',
      link: '/admin/vehicles?status=PENDING',
      linkLabel: 'Verify vehicles'
    },
    {
      label: 'Active Rides Today',
      value: summary?.activeRidesToday,
      icon: MapPin,
      color: 'bg-emerald-50 text-emerald-600',
      link: '/admin/rides',
      linkLabel: 'Monitor rides'
    },
    {
      label: 'Trips This Month',
      value: summary?.tripsThisMonth,
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-600',
      link: '/admin/reports',
      linkLabel: 'View reports'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600 shadow-2xs">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Organization management overview</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <Skeleton variant="circle" className="w-10 h-10" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map((card, idx) => (
              <Link
                key={card.label}
                to={card.link}
                className={`bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-teal-300 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 group flex flex-col justify-between stagger-${idx + 1}`}
              >
                <div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110 shadow-2xs ${card.color}`}
                  >
                    <card.icon className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    <AnimatedNumber value={card.value ?? 0} />
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
                </div>
                <p className="text-xs text-teal-600 font-semibold mt-3 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {card.linkLabel}{' '}
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/admin/settings"
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200"
            >
              <h3 className="font-semibold text-gray-800 mb-1 text-base">Organization Settings</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Manage fuel prices, cancellation policies, registration codes, and more.
              </p>
            </Link>
            <Link
              to="/admin/reports"
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200"
            >
              <h3 className="font-semibold text-gray-800 mb-1 text-base">Analytics & Reports</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                View travel cost analysis, fuel efficiency trends, and employee participation.
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
