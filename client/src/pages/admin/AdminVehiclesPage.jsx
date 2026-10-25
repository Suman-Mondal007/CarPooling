import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminVehicles, verifyVehicle } from '../../api/admin.api.js';
import { Car, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Fuel, Users as SeatsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal.jsx';
import Badge from '../../components/common/Badge.jsx';
import { SkeletonTableRows } from '../../components/common/Skeleton.jsx';

export default function AdminVehiclesPage() {
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || searchParams.get('verificationStatus') || ''
  );
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Verification modal state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [actionType, setActionType] = useState(null); // 'VERIFIED' | 'REJECTED'
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) {
        params.status = statusFilter;
        params.verificationStatus = statusFilter;
      }

      const res = await getAdminVehicles(params);
      const data = res.data?.data;
      if (data) {
        setVehicles(data.vehicles || data.items || []);
        setPagination({
          page: data.pagination?.page || 1,
          limit: data.pagination?.limit || 10,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 1
        });
      }
    } catch {
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchVehicles(1);
  }, [fetchVehicles]);

  const handleOpenAction = (vehicle, targetStatus) => {
    setSelectedVehicle(vehicle);
    setActionType(targetStatus);
    setRejectionReason('');
  };

  const handleConfirmAction = async () => {
    if (!selectedVehicle || !actionType) return;
    try {
      setSubmitting(true);
      await verifyVehicle(selectedVehicle._id, {
        decision: actionType,
        status: actionType,
        reason: actionType === 'REJECTED' ? rejectionReason.trim() : undefined,
        rejectionReason: actionType === 'REJECTED' ? rejectionReason.trim() : undefined
      });
      toast.success(`Vehicle marked as ${actionType}`);
      setSelectedVehicle(null);
      fetchVehicles(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update vehicle status');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="success">Verified</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending Verification</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicle Verification</h1>
            <p className="text-sm text-gray-500">Review employee vehicle registrations, seating specs, and verification state</p>
          </div>
        </div>
        <button
          onClick={() => fetchVehicles(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by registration number, model, or owner..."
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
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={5} cols={6} />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No vehicles found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search query or verification filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Vehicle Details</th>
                    <th className="px-4 py-3">Registration</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Specs</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v) => (
                    <tr key={v._id} className="hover:bg-teal-50/40 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs uppercase">
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{v.model}</p>
                            <p className="text-xs text-gray-500 capitalize">{v.type?.toLowerCase() || 'Car'}{v.color ? ` • ${v.color}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-800 rounded border border-gray-200">
                          {v.registrationNumber}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{v.owner?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{v.owner?.email || '—'}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-600 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <SeatsIcon className="w-3.5 h-3.5 text-gray-400" />
                          <span>{v.seatingCapacity} Seats (Total)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Fuel className="w-3.5 h-3.5 text-gray-400" />
                          <span>{v.fuelType} • {v.fuelEfficiencyKmpl || 0} km/L</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(v.verificationStatus)}
                        {v.verificationStatus === 'REJECTED' && v.rejectionReason && (
                          <p className="text-xs text-rose-500 mt-1 max-w-xs">{v.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {v.verificationStatus !== 'VERIFIED' && (
                            <button
                              onClick={() => handleOpenAction(v, 'VERIFIED')}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                            >
                              Verify
                            </button>
                          )}
                          {v.verificationStatus !== 'REJECTED' && (
                            <button
                              onClick={() => handleOpenAction(v, 'REJECTED')}
                              className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {vehicles.map((v) => (
                <div key={v._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{v.model}</p>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-800 rounded border border-gray-200 mt-1 inline-block">
                        {v.registrationNumber}
                      </span>
                    </div>
                    {getStatusBadge(v.verificationStatus)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-gray-400 block">Owner:</span>
                      <span className="font-medium text-gray-800">{v.owner?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Capacity:</span>
                      <span>{v.seatingCapacity} seats</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Fuel:</span>
                      <span>{v.fuelType}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Efficiency:</span>
                      <span>{v.fuelEfficiencyKmpl || 0} km/L</span>
                    </div>
                  </div>
                  {v.verificationStatus === 'REJECTED' && v.rejectionReason && (
                    <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded">
                      Reason: {v.rejectionReason}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {v.verificationStatus !== 'VERIFIED' && (
                      <button
                        onClick={() => handleOpenAction(v, 'VERIFIED')}
                        className="flex-1 py-1.5 text-xs font-medium text-center text-emerald-700 bg-emerald-50 rounded-lg"
                      >
                        Verify Vehicle
                      </button>
                    )}
                    {v.verificationStatus !== 'REJECTED' && (
                      <button
                        onClick={() => handleOpenAction(v, 'REJECTED')}
                        className="flex-1 py-1.5 text-xs font-medium text-center text-rose-700 bg-rose-50 rounded-lg"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} vehicles</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchVehicles(pagination.page - 1)}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-gray-700">Page {pagination.page} of {pagination.pages}</span>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchVehicles(pagination.page + 1)}
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

      {/* Verification / Rejection Modal */}
      {selectedVehicle && (
        <Modal
          isOpen={!!selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          title={`${actionType === 'VERIFIED' ? 'Verify' : 'Reject'} Vehicle: ${selectedVehicle.model}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {actionType === 'VERIFIED'
                ? `Confirm vehicle verification for registration number ${selectedVehicle.registrationNumber}? The employee will be permitted to offer rides with this vehicle.`
                : `Are you sure you want to reject this vehicle registration (${selectedVehicle.registrationNumber})?`}
            </p>
            {actionType === 'REJECTED' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Rejection Reason (Required):
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete RC document or invalid registration number format..."
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || (actionType === 'REJECTED' && !rejectionReason.trim())}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
                  actionType === 'VERIFIED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Processing...' : actionType === 'VERIFIED' ? 'Confirm Verification' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
