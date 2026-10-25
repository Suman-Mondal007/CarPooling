import React, { useState, useEffect, useCallback } from 'react';
import { getAdminReports, getAdminReportsCsv } from '../../api/admin.api.js';
import {
  BarChart2, TrendingUp, Car, MapPin, Fuel, Download,
  Calendar, Users, Info, IndianRupee, Leaf, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx';

export default function AdminReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};

      const now = new Date();
      if (dateRange === '7d') {
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.from = from.toISOString();
        params.to = now.toISOString();
      } else if (dateRange === '30d') {
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.from = from.toISOString();
        params.to = now.toISOString();
      } else if (dateRange === '90d') {
        const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        params.from = from.toISOString();
        params.to = now.toISOString();
      } else if (dateRange === 'custom') {
        if (customFrom) params.from = new Date(customFrom).toISOString();
        if (customTo) params.to = new Date(customTo).toISOString();
      }

      const res = await getAdminReports(params);
      setReport(res.data?.data);
    } catch {
      toast.error('Failed to load organization reports');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      const params = {};
      const now = new Date();
      if (dateRange === '7d') {
        params.from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        params.to = now.toISOString();
      } else if (dateRange === '30d') {
        params.from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        params.to = now.toISOString();
      } else if (dateRange === '90d') {
        params.from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        params.to = now.toISOString();
      } else if (dateRange === 'custom') {
        if (customFrom) params.from = new Date(customFrom).toISOString();
        if (customTo) params.to = new Date(customTo).toISOString();
      }

      const res = await getAdminReportsCsv(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organization-reports-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Report CSV downloaded');
    } catch {
      toast.error('Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  const summary = report?.summary;
  const participation = summary?.participation;
  const vehicleStats = report?.vehicleWiseCost || [];
  const monthlyTrend = report?.monthlyTrend || [];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organization Analytics & Reports</h1>
            <p className="text-sm text-gray-500">Commute mileage, estimated fuel consumption, cost trends, and employee participation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            disabled={downloading}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>Period:</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
              { id: 'custom', label: 'Custom' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  dateRange === tab.id
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="p-1.5 border border-gray-200 rounded-lg"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="p-1.5 border border-gray-200 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Estimate Disclaimer Banner */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 mb-6 flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Calculation Transparency:</span> Distance figures reflect actual stored routes of completed trips. Fuel, travel costs, and CO₂ savings are estimates derived from vehicle fuel efficiency, organization fuel settings (₹{report?.metadata?.fuelPricePerLitre || 100}/L), and IPCC emissions standards.
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Key Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Completed Trips</span>
                <Car className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary?.completedTrips || 0}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {summary?.cancelledTrips || 0} cancelled ({summary?.lateCancellations || 0} late)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Distance Traveled</span>
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalDistanceKm || 0} <span className="text-sm font-normal text-gray-500">km</span></p>
              <p className="text-[11px] text-gray-400 mt-0.5">Across all completed rides</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Estimated Fuel Used</span>
                <Fuel className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary?.fuelConsumptionLitres?.value || 0} <span className="text-sm font-normal text-gray-500">L</span></p>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Estimated consumption</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Est. Travel Cost</span>
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ₹<AnimatedNumber value={summary?.totalTravelCost || 0} />
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                ₹{summary?.costPerKm?.value || 0}/km est.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Bookings & Seats</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                <AnimatedNumber value={summary?.totalSeatsShared || 0} />{' '}
                <span className="text-sm font-normal text-gray-500">seats</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{summary?.totalBookings || 0} booking reservations</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Average Occupancy</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{((summary?.avgOccupancy || 0) * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Offered vs booked seats</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Est. CO₂ Prevented</span>
                <Leaf className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                <AnimatedNumber value={summary?.co2SavedKg?.value || 0} />{' '}
                <span className="text-sm font-normal text-gray-500">kg</span>
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Avoided solo trips</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-medium">Participation Rate</span>
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{((participation?.participationRate || 0) * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {participation?.totalParticipants || 0} of {participation?.totalEmployees || 0} employees
              </p>
            </div>
          </div>

          {/* Charts Row */}
          {monthlyTrend.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  Trips & Seat Reservations Trend
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="completedTrips"
                        name="Completed Trips"
                        fill="#0d9488"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Bar
                        dataKey="bookedSeats"
                        name="Seats Shared"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-amber-600" />
                  Fuel Consumption per Passenger-KM (L/pkm)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line
                        type="monotone"
                        dataKey="fuelPerPassengerKm"
                        name="Fuel / Passenger-Km (L)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle-wise Breakdown Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Vehicle-Wise Cost & Distance Breakdown</h3>
                <p className="text-xs text-gray-500">Aggregated mileage and estimated travel cost per employee vehicle</p>
              </div>
              <span className="text-xs text-gray-400 font-mono">{vehicleStats.length} vehicles recorded</span>
            </div>

            {vehicleStats.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No vehicle trip records found in this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Vehicle</th>
                      <th className="px-4 py-3">Registration</th>
                      <th className="px-4 py-3">Fuel Type</th>
                      <th className="px-4 py-3">Completed Trips</th>
                      <th className="px-4 py-3">Distance (km)</th>
                      <th className="px-4 py-3">Est. Fuel (L)</th>
                      <th className="px-4 py-3">Est. Total Cost</th>
                      <th className="px-6 py-3 text-right">Cost / km</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vehicleStats.map((v, i) => (
                      <tr key={v.vehicleId || i} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-3.5 font-medium text-gray-900">
                          {v.model}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs">
                          {v.registrationNumber}
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {v.fuelType}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-800">
                          {v.trips}
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {v.distanceKm} km
                        </td>
                        <td className="px-4 py-3.5 text-xs text-amber-700">
                          {v.fuelLitres} L
                        </td>
                        <td className="px-4 py-3.5 text-xs font-semibold text-gray-900">
                          ₹{v.cost.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-xs text-gray-700">
                          ₹{v.costPerKm}/km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
