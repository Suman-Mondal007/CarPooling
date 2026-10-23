import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  Car
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import authApi from '../../api/auth.api.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';

const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit Indian phone number'),
  licenceNumber: z.string().trim().optional(),
  licenceExpiry: z.string().optional()
});

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      licenceNumber: user?.licenceNumber || '',
      licenceExpiry: user?.licenceExpiry ? new Date(user.licenceExpiry).toISOString().split('T')[0] : ''
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        phone: user.phone || '',
        licenceNumber: user.licenceNumber || '',
        licenceExpiry: user.licenceExpiry ? new Date(user.licenceExpiry).toISOString().split('T')[0] : ''
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        name: data.name,
        phone: data.phone,
        licenceNumber: data.licenceNumber,
        licenceExpiry: data.licenceExpiry ? new Date(data.licenceExpiry) : undefined
      };

      const res = await authApi.updateProfile(payload);
      if (res?.data?.user) {
        updateUser(res.data.user);
        setSuccessMessage('Profile updated successfully!');
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error?.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xl uppercase">
            {user?.name ? user.name.charAt(0) : 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <div className="flex items-center space-x-2 mt-1.5">
              <Badge variant="emerald" size="sm">Active Employee</Badge>
              {user?.employeeId && (
                <span className="text-[11px] text-slate-500 font-mono">ID: {user.employeeId}</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="block font-semibold text-slate-800">{user?.organization?.name || 'Enterprise'}</span>
          <span className="block text-[11px] text-teal-700 font-mono">Code: {user?.organization?.registrationCode}</span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Edit Profile Form */}
      <Card>
        <CardHeader
          title="Personal Information"
          subtitle="Update your contact details and optional driver credentials"
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              icon={UserIcon}
              required
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Work Email (Permanent)"
              type="email"
              icon={Mail}
              value={user?.email || ''}
              disabled
              helperText="Managed by your organization administrator"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              icon={Phone}
              required
              helperText="Used for ride-day driver/passenger calling links"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Employee ID"
              icon={Shield}
              value={user?.employeeId || 'Not specified'}
              disabled
              helperText="Assigned upon corporate onboarding"
            />
          </div>

          {/* Driver Information Section */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center space-x-2 mb-3">
              <Car className="w-4 h-4 text-teal-600" />
              <h4 className="text-sm font-semibold text-slate-800">
                Driver Credentials (Optional)
              </h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Required if you intend to offer rides and register vehicles.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Driving Licence Number"
                placeholder="e.g. KA0120220001234"
                error={errors.licenceNumber?.message}
                {...register('licenceNumber')}
              />

              <Input
                label="Licence Expiry Date"
                type="date"
                error={errors.licenceExpiry?.message}
                {...register('licenceExpiry')}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="primary" loading={loading}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ProfilePage;
