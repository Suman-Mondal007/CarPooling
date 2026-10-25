import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminEmployees, updateEmployeeStatus } from '../../api/admin.api.js';
import { Users, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal.jsx';
import Badge from '../../components/common/Badge.jsx';
import { SkeletonTableRows } from '../../components/common/Skeleton.jsx';

export default function AdminEmployeesPage() {
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Confirmation modal state
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionType, setActionType] = useState(null); // 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;

      const res = await getAdminEmployees(params);
      const data = res.data?.data;
      if (data) {
        setEmployees(data.employees || []);
        setPagination({
          page: data.pagination?.page || 1,
          limit: data.pagination?.limit || 10,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 1
        });
      }
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchEmployees(1);
  }, [fetchEmployees]);

  const handleOpenAction = (employee, targetStatus) => {
    setSelectedEmployee(employee);
    setActionType(targetStatus);
    setActionReason('');
  };

  const handleConfirmAction = async () => {
    if (!selectedEmployee || !actionType) return;
    try {
      setSubmitting(true);
      await updateEmployeeStatus(selectedEmployee._id, {
        status: actionType,
        reason: actionReason.trim() || undefined
      });
      toast.success(`Employee marked as ${actionType}`);
      setSelectedEmployee(null);
      fetchEmployees(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update employee status');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>;
      case 'DEACTIVATED':
        return <Badge variant="default">Deactivated</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
            <p className="text-sm text-gray-500">Approve registrations, manage access, and inspect driver verification</p>
          </div>
        </div>
        <button
          onClick={() => fetchEmployees(pagination.page)}
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
            placeholder="Search by employee name, email, phone or ID..."
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
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={5} cols={6} />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No employees found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria or status filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Driver Info</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-teal-50/40 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-500">{emp.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-gray-700">
                        {emp.employeeId || '—'}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {emp.phone || '—'}
                      </td>
                      <td className="px-4 py-4">
                        {emp.licenceNumber ? (
                          <div className="flex items-center gap-1.5 text-xs text-teal-700 font-mono">
                            <Award className="w-3.5 h-3.5 text-teal-600" />
                            <span>{emp.licenceNumber}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not registered</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(emp.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {emp.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => handleOpenAction(emp, 'ACTIVE')}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenAction(emp, 'DEACTIVATED')}
                                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {emp.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleOpenAction(emp, 'SUSPENDED')}
                                className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition"
                              >
                                Suspend
                              </button>
                              <button
                                onClick={() => handleOpenAction(emp, 'DEACTIVATED')}
                                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                          {(emp.status === 'SUSPENDED' || emp.status === 'DEACTIVATED') && (
                            <button
                              onClick={() => handleOpenAction(emp, 'ACTIVE')}
                              className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition"
                            >
                              Reactivate
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
              {employees.map((emp) => (
                <div key={emp._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </div>
                    {getStatusBadge(emp.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-gray-400 block">Employee ID:</span>
                      <span className="font-mono">{emp.employeeId || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Phone:</span>
                      <span>{emp.phone || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 block">Driver Licence:</span>
                      <span className="font-mono">{emp.licenceNumber || 'Not registered'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {emp.status === 'PENDING_APPROVAL' && (
                      <>
                        <button
                          onClick={() => handleOpenAction(emp, 'ACTIVE')}
                          className="flex-1 py-1.5 text-xs font-medium text-center text-emerald-700 bg-emerald-50 rounded-lg"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenAction(emp, 'DEACTIVATED')}
                          className="flex-1 py-1.5 text-xs font-medium text-center text-rose-700 bg-rose-50 rounded-lg"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {emp.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleOpenAction(emp, 'SUSPENDED')}
                          className="flex-1 py-1.5 text-xs font-medium text-center text-amber-700 bg-amber-50 rounded-lg"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => handleOpenAction(emp, 'DEACTIVATED')}
                          className="flex-1 py-1.5 text-xs font-medium text-center text-gray-700 bg-gray-100 rounded-lg"
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                    {(emp.status === 'SUSPENDED' || emp.status === 'DEACTIVATED') && (
                      <button
                        onClick={() => handleOpenAction(emp, 'ACTIVE')}
                        className="w-full py-1.5 text-xs font-medium text-center text-teal-700 bg-teal-50 rounded-lg"
                      >
                        Reactivate Account
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} employees</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchEmployees(pagination.page - 1)}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-gray-700">Page {pagination.page} of {pagination.pages}</span>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchEmployees(pagination.page + 1)}
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

      {/* Confirmation Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          title={`Confirm Status Change: ${selectedEmployee.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to change this employee&apos;s status to{' '}
              <strong className="text-gray-900">{actionType}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason or Notes (Optional):
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Approved onboarding documents or temporary administrative hold..."
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmAction}
                className="px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
