import React, { useState, useEffect, useCallback } from 'react';
import { getAdminRides } from '../../api/admin.api.js';
import { Activity, Search, Filter, Calendar, MapPin, Users, RefreshCw, ChevronLeft, ChevronRight, Eye, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal.jsx';
import Badge from '../../components/common/Badge.jsx';

export default function AdminRidesPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Detail modal state
  const [selectedRide, setSelectedRide] = useState(null);

  const fetchRides = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;

      const res = await getAdminRides(params);
      const data = res.data?.data;
      if (data) {
        setRides(data.rides || []);
        setPagination({
          page: data.pagination?.page || 1,
          limit: data.pagination?.limit || 10,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 1
        });
      }
    } catch {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchRides(1);
  }, [fetchRides]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>;
      case 'STARTED':
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ride Monitoring</h1>
            <p className="text-sm text-gray-500">Read-only operational overview of organization commute rides</p>
          </div>
        </div>
        <button
          onClick={() => fetchRides(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Info notice about read-only / privacy */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 mb-6 flex items-start gap-2.5 text-xs text-amber-800">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Privacy Policy Enforced:</span> Company administrators have read-only access to ride schedules and participant counts. In-ride chat communications and personal messages remain strictly private to participants.
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by route, address, or driver name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open / Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Rides Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            Loading rides...
          </div>
        ) : rides.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No rides found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria or status filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Route & Departure</th>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Occupancy</th>
                    <th className="px-4 py-3">Fare / Seat</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rides.map((ride) => (
                    <tr key={ride._id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium truncate max-w-xs">
                            <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                            <span className="truncate">{ride.origin?.address || 'Origin'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium truncate max-w-xs">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="truncate">{ride.destination?.address || 'Destination'}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 pt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(ride.departureAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900">{ride.driver?.name || 'Driver'}</p>
                        <p className="text-xs text-gray-400">{ride.driver?.email || '—'}</p>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <p className="font-medium text-gray-800">{ride.vehicle?.model || ride.vehicleSnapshot?.model || 'Vehicle'}</p>
                        <p className="font-mono text-gray-500">{ride.vehicle?.registrationNumber || ride.vehicleSnapshot?.registrationNumber || '—'}</p>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span>{ride.totalSeats - (ride.availableSeats ?? 0)} / {ride.totalSeats} Booked</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900 text-xs">
                        ₹{((ride.farePerSeatMinor || 0) / 100).toFixed(0)}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(ride.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedRide(ride)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {rides.map((ride) => (
                <div key={ride._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">DRIVER</p>
                      <p className="font-semibold text-gray-900">{ride.driver?.name}</p>
                    </div>
                    {getStatusBadge(ride.status)}
                  </div>
                  <div className="space-y-1 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg">
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                      <span className="truncate">{ride.origin?.address}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate">{ride.destination?.address}</span>
                    </p>
                    <p className="text-gray-500 pt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(ride.departureAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{ride.vehicle?.model || ride.vehicleSnapshot?.model} ({ride.vehicle?.registrationNumber || ride.vehicleSnapshot?.registrationNumber})</span>
                    <span className="font-semibold text-gray-900">₹{((ride.farePerSeatMinor || 0) / 100).toFixed(0)} / seat</span>
                  </div>
                  <button
                    onClick={() => setSelectedRide(ride)}
                    className="w-full py-1.5 text-xs font-medium text-center text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
                  >
                    View Ride Overview
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} rides</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchRides(pagination.page - 1)}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-gray-700">Page {pagination.page} of {pagination.pages}</span>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchRides(pagination.page + 1)}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ride Overview Modal */}
      {selectedRide && (
        <Modal
          isOpen={!!selectedRide}
          onClose={() => setSelectedRide(null)}
          title="Ride Overview (Read-Only)"
        >
          <div className="space-y-4 text-sm">
            {/* Route Details */}
            <div className="p-3 bg-gray-50 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Pickup Origin</p>
                  <p className="font-medium text-gray-800">{selectedRide.origin?.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Drop Destination</p>
                  <p className="font-medium text-gray-800">{selectedRide.destination?.address}</p>
                </div>
              </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Driver</span>
                <span className="font-semibold text-gray-800">{selectedRide.driver?.name}</span>
                <span className="text-gray-500 block truncate">{selectedRide.driver?.email}</span>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Vehicle</span>
                <span className="font-semibold text-gray-800">{selectedRide.vehicle?.model || selectedRide.vehicleSnapshot?.model}</span>
                <span className="font-mono text-gray-500 block">{selectedRide.vehicle?.registrationNumber || selectedRide.vehicleSnapshot?.registrationNumber}</span>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Departure</span>
                <span className="font-medium text-gray-800">{formatDate(selectedRide.departureAt)}</span>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Distance & Duration</span>
                <span className="font-medium text-gray-800">
                  {selectedRide.routeDistanceMeters ? `${(selectedRide.routeDistanceMeters / 1000).toFixed(1)} km` : '—'}
                  {selectedRide.routeDurationSeconds ? ` • ${Math.round(selectedRide.routeDurationSeconds / 60)} mins` : ''}
                </span>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Fare Per Seat</span>
                <span className="font-semibold text-gray-900">₹{((selectedRide.farePerSeatMinor || 0) / 100).toFixed(0)}</span>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-lg">
                <span className="text-gray-400 block">Seats Occupancy</span>
                <span className="font-medium text-gray-800">
                  {selectedRide.totalSeats - (selectedRide.availableSeats ?? 0)} of {selectedRide.totalSeats} Booked
                </span>
              </div>
            </div>

            {/* Bookings / Passengers */}
            {selectedRide.bookings && selectedRide.bookings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Confirmed Bookings</h4>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {selectedRide.bookings.map((b) => (
                    <div key={b._id} className="p-2.5 flex items-center justify-between text-xs bg-white">
                      <div>
                        <span className="font-medium text-gray-800">{b.passenger?.name || 'Passenger'}</span>
                        <span className="text-gray-400 ml-2">({b.seats} seat{b.seats > 1 ? 's' : ''})</span>
                      </div>
                      <Badge variant={b.status === 'CONFIRMED' || b.status === 'COMPLETED' ? 'success' : 'default'}>
                        {b.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRide(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
