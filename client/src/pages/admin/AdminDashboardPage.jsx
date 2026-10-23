import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Car,
  Activity,
  Settings,
  Key,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const org = user?.organization;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
              Corporate Administrator
            </span>
            <Badge variant="purple" size="sm">Organization Tenant</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {org?.name || 'Company Administration'}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl">
            Manage organization-wide employee verification, vehicle approval, carpooling policies, and commute analytics.
          </p>
        </div>

        {/* Registration Code Badge */}
        <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shrink-0 text-right">
          <div className="flex items-center space-x-2 text-teal-400 text-xs font-medium mb-1">
            <Key className="w-4 h-4" />
            <span>Registration Code</span>
          </div>
          <span className="text-2xl font-mono font-black text-white tracking-wider block">
            {org?.registrationCode || 'ACME2026'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Share with new employee signups</span>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Employees</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">4</div>
          <p className="text-[11px] text-slate-400 mt-1">1 Admin, 3 Active Employees</p>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Vehicles</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">2</div>
          <p className="text-[11px] text-slate-400 mt-1">Verification workflow enabled</p>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Rides Today</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">0</div>
          <p className="text-[11px] text-slate-400 mt-1">Real-time trip monitoring</p>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fuel Price Config</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{org?.settings?.fuelPricePerLitre || 105}/L
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Used for employee cost formulas</p>
        </Card>
      </div>

      {/* Admin Modules Grid */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            hover
            onClick={() => navigate('/admin/employees')}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Employee Management</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Review pending employee registrations, approve accounts, suspend or deactivate access, and verify driver licence details.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-600">
              <span>Manage Employees</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Card>

          <Card
            hover
            onClick={() => navigate('/admin/vehicles')}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Vehicle Verification</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Inspect registered employee vehicles, verify registration plate numbers, confirm seating capacities, and approve vehicles for ride publishing.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-blue-600">
              <span>Inspect Vehicles</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Card>

          <Card
            hover
            onClick={() => navigate('/admin/settings')}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Organization Settings</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Configure auto-approval rules, cancellation cutoff windows, fuel price reference values, timezone, and regenerate registration codes.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-slate-800">
              <span>Configure Settings</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
