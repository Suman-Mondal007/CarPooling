import React, { useState, useEffect } from 'react';
import { getAdminSettings, updateAdminSettings, regenerateCode } from '../../api/admin.api.js';
import { Settings, Key, RefreshCw, Save, Check, Copy, AlertTriangle, Shield, Clock, Fuel, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal.jsx';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings form state
  const [name, setName] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(100);
  const [operationalCostPerKm, setOperationalCostPerKm] = useState(0);
  const [cancellationCutoffMinutes, setCancellationCutoffMinutes] = useState(60);
  const [autoApproveEmployees, setAutoApproveEmployees] = useState(false);
  const [requireVehicleVerification, setRequireVehicleVerification] = useState(true);
  const [requireEmployeeId, setRequireEmployeeId] = useState(false);
  const [allowStartWithoutPassengers, setAllowStartWithoutPassengers] = useState(false);

  // Regenerate Code Modal
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    getAdminSettings()
      .then((res) => {
        const data = res.data?.data;
        if (data) {
          setName(data.name || '');
          setRegistrationCode(data.registrationCode || '');
          setTimezone(data.timezone || 'Asia/Kolkata');

          const s = data.settings || {};
          if (s.fuelPricePerLitre !== undefined) setFuelPricePerLitre(s.fuelPricePerLitre);
          if (s.operationalCostPerKm !== undefined) setOperationalCostPerKm(s.operationalCostPerKm);
          if (s.cancellationCutoffMinutes !== undefined) setCancellationCutoffMinutes(s.cancellationCutoffMinutes);
          if (s.autoApproveEmployees !== undefined) setAutoApproveEmployees(s.autoApproveEmployees);
          if (s.requireVehicleVerification !== undefined) setRequireVehicleVerification(s.requireVehicleVerification);
          if (s.requireEmployeeId !== undefined) setRequireEmployeeId(s.requireEmployeeId);
          if (s.allowStartWithoutPassengers !== undefined) setAllowStartWithoutPassengers(s.allowStartWithoutPassengers);
        }
      })
      .catch(() => toast.error('Failed to load organization settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyCode = () => {
    if (!registrationCode) return;
    navigator.clipboard.writeText(registrationCode);
    setCopied(true);
    toast.success('Registration code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    try {
      setRegenerating(true);
      const res = await regenerateCode();
      const newCode = res.data?.data?.registrationCode;
      if (newCode) {
        setRegistrationCode(newCode);
        toast.success('Registration code regenerated!');
      }
      setShowRegenModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateAdminSettings({
        timezone,
        fuelPricePerLitre: Number(fuelPricePerLitre),
        operationalCostPerKm: Number(operationalCostPerKm),
        cancellationCutoffMinutes: Number(cancellationCutoffMinutes),
        autoApproveEmployees: Boolean(autoApproveEmployees),
        requireVehicleVerification: Boolean(requireVehicleVerification),
        requireEmployeeId: Boolean(requireEmployeeId),
        allowStartWithoutPassengers: Boolean(allowStartWithoutPassengers)
      });
      toast.success('Organization settings updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
          <p className="text-sm text-gray-500">{name || 'Company Configuration'} policies and parameters</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Registration Code Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Registration Access Code</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Employees require this unique code to sign up for your organization. Existing members are not affected when regenerated.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-mono text-base font-bold text-gray-900 tracking-wider">
                {registrationCode || '••••••••'}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowRegenModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Code
            </button>
          </div>
        </div>

        {/* Commute & Fuel Pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Fuel className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-gray-900">Fuel & Cost Analytics Defaults</h2>
          </div>
          <p className="text-xs text-gray-500">
            These values calibrate travel cost metrics, reporting estimations, and recommended fair fares.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fuel Price Per Litre (₹/L)
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="0.5"
                  value={fuelPricePerLitre}
                  onChange={(e) => setFuelPricePerLitre(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
                />
              </div>
              <span className="text-[11px] text-gray-400 mt-0.5 block">Standard benchmark for fuel consumption cost</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Operational Cost Per Km (₹/km)
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={operationalCostPerKm}
                  onChange={(e) => setOperationalCostPerKm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
                />
              </div>
              <span className="text-[11px] text-gray-400 mt-0.5 block">Optional vehicle maintenance & wear allocation</span>
            </div>
          </div>
        </div>

        {/* Operational Policies */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Trip & Booking Policies</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Cancellation Cutoff Window (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={cancellationCutoffMinutes}
                  onChange={(e) => setCancellationCutoffMinutes(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500"
                />
              </div>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Cancellations within this period before departure are marked late
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Organization Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-teal-500 bg-white"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </select>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="pt-2 divide-y divide-gray-100 space-y-3">
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Auto-Approve Employee Signups</p>
                <p className="text-xs text-gray-500">Automatically set newly registered employees to Active status</p>
              </div>
              <input
                type="checkbox"
                checked={autoApproveEmployees}
                onChange={(e) => setAutoApproveEmployees(e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Require Vehicle Verification</p>
                <p className="text-xs text-gray-500">Drivers must have vehicles admin-verified before offering rides</p>
              </div>
              <input
                type="checkbox"
                checked={requireVehicleVerification}
                onChange={(e) => setRequireVehicleVerification(e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Require Employee ID</p>
                <p className="text-xs text-gray-500">Mandate company corporate ID upon employee registration</p>
              </div>
              <input
                type="checkbox"
                checked={requireEmployeeId}
                onChange={(e) => setRequireEmployeeId(e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Allow Starting Trips Without Passengers</p>
                <p className="text-xs text-gray-500">Allow drivers to start scheduled rides even if zero seats are booked</p>
              </div>
              <input
                type="checkbox"
                checked={allowStartWithoutPassengers}
                onChange={(e) => setAllowStartWithoutPassengers(e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving changes...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Regenerating Code */}
      {showRegenModal && (
        <Modal
          isOpen={showRegenModal}
          onClose={() => setShowRegenModal(false)}
          title="Regenerate Registration Code"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice:</span> Regenerating the registration code will immediately invalidate the existing code ({registrationCode}) for new signups. Any invitations currently in flight must be sent the new code.
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to generate a new registration code for your organization?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={regenerating}
                onClick={handleRegenerateCode}
                className="px-4 py-2 text-sm text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium disabled:opacity-50"
              >
                {regenerating ? 'Regenerating...' : 'Yes, Regenerate Code'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
