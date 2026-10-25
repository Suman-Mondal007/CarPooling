import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { updateSettings, changePassword } from '../../api/admin.api.js';
import authApi from '../../api/auth.api.js';
import { User, Bell, CreditCard, Shield, HelpCircle, MapPin, Car, History, MessageSquare, BarChart3, ChevronRight, Lock, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();

  // Profile state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    employeeId: user?.employeeId || '',
    licenceNumber: user?.licenceNumber || '',
    licenceExpiry: user?.licenceExpiry ? new Date(user.licenceExpiry).toISOString().split('T')[0] : ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    bookings: user?.notificationPreferences?.bookings ?? true,
    tripUpdates: user?.notificationPreferences?.tripUpdates ?? true,
    chat: user?.notificationPreferences?.chat ?? true,
    payments: user?.notificationPreferences?.payments ?? true
  });

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState(user?.preferredPaymentMethod || '');

  // Password
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const data = { ...profile, notificationPreferences: notifPrefs };
      if (data.licenceExpiry) data.licenceExpiry = new Date(data.licenceExpiry).toISOString();
      else data.licenceExpiry = null;
      const res = await updateSettings(data);
      if (updateUser) updateUser(res.data?.data?.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally { setSavingProfile(false); }
  };

  const handlePaymentPref = async (method) => {
    setPaymentMethod(method);
    try {
      await authApi.updatePaymentPreference(method || null);
      toast.success('Payment preference saved');
    } catch { toast.error('Failed to update preference'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error("Passwords don't match");
    setChangingPw(true);
    try {
      await changePassword(passwordForm);
      toast.success('Password changed. Other sessions revoked.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to change password');
    } finally { setChangingPw(false); }
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-xl border p-5 mb-4">
      <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-teal-600" />{title}</h3>
      {children}
    </div>
  );

  const QuickLink = ({ to, icon: Icon, label }) => (
    <Link to={to} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition border border-gray-100">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Icon className="w-4 h-4 text-gray-400" />{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </Link>
  );

  const Toggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <div><p className="text-sm font-medium text-gray-700">{label}</p>{description && <p className="text-xs text-gray-400">{description}</p>}</div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-teal-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Profile */}
      <Section title="Profile" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
            <input type="text" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input type="text" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Employee ID</label>
            <input type="text" value={profile.employeeId} onChange={(e) => setProfile((p) => ({ ...p, employeeId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Licence Number</label>
            <input type="text" value={profile.licenceNumber} onChange={(e) => setProfile((p) => ({ ...p, licenceNumber: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Licence Expiry</label>
            <input type="date" value={profile.licenceExpiry} onChange={(e) => setProfile((p) => ({ ...p, licenceExpiry: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition">
          <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </Section>

      {/* Notification Preferences */}
      <Section title="Notifications" icon={Bell}>
        <Toggle label="Bookings" description="New bookings and booking updates" checked={notifPrefs.bookings} onChange={(v) => setNotifPrefs((p) => ({ ...p, bookings: v }))} />
        <Toggle label="Trip Updates" description="Trip start, progress, and completion" checked={notifPrefs.tripUpdates} onChange={(v) => setNotifPrefs((p) => ({ ...p, tripUpdates: v }))} />
        <Toggle label="Chat Messages" description="New messages from trip participants" checked={notifPrefs.chat} onChange={(v) => setNotifPrefs((p) => ({ ...p, chat: v }))} />
        <Toggle label="Payments" description="Payment confirmations and receipts" checked={notifPrefs.payments} onChange={(v) => setNotifPrefs((p) => ({ ...p, payments: v }))} />
        <p className="text-xs text-gray-400 mt-2">⚠️ Critical notices (ride cancellations, account changes) are always delivered regardless of these settings.</p>
        <button onClick={handleSaveProfile} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition">
          Save Preferences
        </button>
      </Section>

      {/* Payment Method */}
      <Section title="Default Payment Method" icon={CreditCard}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['WALLET', 'CARD', 'UPI', 'CASH'].map((m) => (
            <button key={m} onClick={() => handlePaymentPref(m)}
              className={`px-4 py-3 rounded-lg text-sm font-medium border transition ${paymentMethod === m ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Card details are never stored. This just sets your default selection on the payment screen.</p>
      </Section>

      {/* Security */}
      <Section title="Security" icon={Shield}>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input type="password" placeholder="Current password" value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          <input type="password" placeholder="New password (min 8 chars, 1 uppercase, 1 number)" value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          <input type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          <button type="submit" disabled={changingPw}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
            <Lock className="w-4 h-4" /> {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </Section>

      {/* Quick Links */}
      <Section title="Quick Links" icon={ChevronRight}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickLink to="/my-trips" icon={Car} label="My Trips" />
          <QuickLink to="/vehicles" icon={Car} label="My Vehicles" />
          <QuickLink to="/history" icon={History} label="Ride History" />
          <QuickLink to="/saved-places" icon={MapPin} label="Saved Places" />
          <QuickLink to="/chat" icon={MessageSquare} label="Chat" />
          <QuickLink to="/reports" icon={BarChart3} label="Commute Reports" />
          <QuickLink to="/help" icon={HelpCircle} label="Help & Support" />
        </div>
      </Section>
    </div>
  );
}
