import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory } from '../../api/admin.api.js';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, Car, MapPin, Calendar, Clock, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  CANCELLED_BY_PASSENGER: 'bg-orange-100 text-orange-800',
  CANCELLED_BY_DRIVER: 'bg-red-100 text-red-800'
};

const PAYMENT_COLORS = {
  PAID: 'bg-emerald-100 text-emerald-800',
  UNPAID: 'bg-amber-100 text-amber-800',
  PAYMENT_PENDING: 'bg-blue-100 text-blue-800',
  'N/A': 'bg-gray-100 text-gray-600'
};

export default function RideHistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    search: '', role: 'all', status: 'all', paymentStatus: 'all',
    dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'desc', page: 1, limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (!params.search) delete params.search;
      if (!params.dateFrom) delete params.dateFrom;
      if (!params.dateTo) delete params.dateTo;
      const res = await getHistory(params);
      setItems(res.data?.data?.items || []);
      setTotal(res.data?.data?.total || 0);
    } catch {
      toast.error('Failed to load ride history');
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const totalPages = Math.ceil(total / filters.limit) || 1;

  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ride History</h1>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by location..." value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-4 bg-gray-50 rounded-xl border">
          <select value={filters.role} onChange={(e) => updateFilter('role', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="all">All roles</option>
            <option value="driver">Driver</option>
            <option value="passenger">Passenger</option>
          </select>
          <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="all">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={filters.paymentStatus} onChange={(e) => updateFilter('paymentStatus', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="all">All payments</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <select value={filters.sortBy} onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="date">Sort by Date</option>
            <option value="fare">Sort by Fare</option>
            <option value="distance">Sort by Distance</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white" />
          <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white" />
          <button onClick={() => updateFilter('sortOrder', filters.sortOrder === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50">
            <ArrowUpDown className="w-3.5 h-3.5" /> {filters.sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No ride history found</p>
          <p className="text-gray-400 text-sm mt-1">Your completed and cancelled trips will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Fare</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} onClick={() => item.tripId && navigate(`/trips/${item.tripId}`)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {new Date(item.departureAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <br /><span className="text-gray-400 text-xs">{new Date(item.departureAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      <div className="truncate font-medium">{item.originAddress}</div>
                      <div className="truncate text-gray-500 text-xs">→ {item.destinationAddress}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.role === 'driver' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {item.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.vehicleModel || '—'}<br/><span className="text-xs text-gray-400">{item.vehicleRegistration}</span></td>
                    <td className="px-4 py-3 text-sm">{((item.distanceMeters || 0) / 1000).toFixed(1)} km</td>
                    <td className="px-4 py-3 text-sm font-medium">₹{((item.fareMinor || 0) / 100).toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.tripStatus] || STATUS_COLORS[item.bookingStatus] || 'bg-gray-100'}`}>
                        {item.bookingStatus || item.tripStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[item.paymentStatus] || 'bg-gray-100'}`}>
                        {item.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {items.map((item, idx) => (
              <div key={idx} onClick={() => item.tripId && navigate(`/trips/${item.tripId}`)}
                className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{new Date(item.departureAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    <Clock className="w-3.5 h-3.5 text-gray-400 ml-1" />
                    <span className="text-xs text-gray-500">{new Date(item.departureAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.role === 'driver' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                    {item.role}
                  </span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm truncate">{item.originAddress} → {item.destinationAddress}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{((item.distanceMeters || 0) / 1000).toFixed(1)} km</span>
                  <span className="font-semibold flex items-center"><IndianRupee className="w-3.5 h-3.5" />{((item.fareMinor || 0) / 100).toFixed(0)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.tripStatus] || 'bg-gray-100'}`}>{item.tripStatus}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">Showing {(filters.page - 1) * filters.limit + 1}–{Math.min(filters.page * filters.limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} disabled={filters.page <= 1}
                className="p-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={filters.page >= totalPages}
                className="p-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
