import React, { useState, useEffect, useCallback } from 'react';
import { getMyReports } from '../../api/admin.api.js';
import { BarChart3, TrendingUp, Car, MapPin, IndianRupee, Fuel, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../../components/common/Skeleton.jsx';
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx';

export default function EmployeeReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.from) params.from = new Date(dateRange.from).toISOString();
      if (dateRange.to) params.to = new Date(dateRange.to).toISOString();
      const res = await getMyReports(params);
      setReport(res.data?.data);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const StatCard = ({ icon: Icon, label, value, numericValue, prefix = '', suffix = '', sub, estimate }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3 shadow-2xs hover:shadow-md hover:border-teal-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="p-2.5 bg-teal-50 rounded-xl text-teal-600 shadow-2xs">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 tracking-tight">
          {numericValue !== undefined ? (
            <>
              {prefix}
              <AnimatedNumber value={numericValue} />
              {suffix}
            </>
          ) : (
            value
          )}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {estimate && (
          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium border border-amber-200/50">
            Estimate
          </span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              <Skeleton variant="circle" className="w-8 h-8" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const d = report?.asDriver || {};
  const p = report?.asPassenger || {};

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 shadow-2xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          My Commute Reports
        </h1>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>
        <button
          onClick={fetchReport}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium shadow-xs hover:shadow-md active:scale-95 transition-all duration-150"
        >
          Apply
        </button>
      </div>

      {/* Estimate notice */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl mb-6 text-sm text-amber-800 leading-relaxed shadow-2xs">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <p className="text-xs">
          Fuel and cost figures are <strong>estimates</strong> computed from recorded route distances and vehicle efficiency. Fuel price: ₹{report?.metadata?.fuelPricePerLitre || '—'}/litre (org setting at report time).
        </p>
      </div>

      {/* As Driver */}
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Car className="w-5 h-5 text-teal-600" /> As Driver
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={TrendingUp}
          label="Trips"
          numericValue={d.completedTrips || 0}
          sub={`of ${d.totalTrips || 0} total`}
        />
        <StatCard
          icon={MapPin}
          label="Distance"
          numericValue={d.distanceKm || 0}
          suffix=" km"
        />
        <StatCard
          icon={Fuel}
          label="Est. Fuel"
          value={`${d.fuelLitres?.value || 0} L`}
          sub={`₹${((d.fuelCost?.value || 0) / 100).toFixed(0)} est. cost`}
          estimate
        />
        <StatCard
          icon={IndianRupee}
          label="Earned"
          numericValue={Math.round(d.amountEarnedRupees || 0)}
          prefix="₹"
          sub="from completed trips"
        />
      </div>

      {/* As Passenger */}
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-indigo-500" /> As Passenger
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={TrendingUp}
          label="Bookings"
          numericValue={p.completedBookings || 0}
          sub={`of ${p.totalBookings || 0} total`}
        />
        <StatCard
          icon={MapPin}
          label="Distance"
          numericValue={p.distanceKm || 0}
          suffix=" km"
        />
        <StatCard
          icon={IndianRupee}
          label="Spent"
          numericValue={Math.round(p.amountSpentRupees || 0)}
          prefix="₹"
        />
        <StatCard
          icon={TrendingUp}
          label="Est. Cost Saved"
          numericValue={Math.round((p.costSaved?.value || 0) / 100)}
          prefix="₹"
          sub={p.costSaved?.assumption || ''}
          estimate
        />
      </div>

      {report?.period && (
        <p className="text-xs text-gray-400 mt-4">
          Period: {new Date(report.period.from).toLocaleDateString()} — {new Date(report.period.to).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
