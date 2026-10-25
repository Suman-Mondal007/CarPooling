import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, AlertCircle, Clock, ShieldAlert, ShieldCheck, User, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Card from '../../components/common/Card.jsx';

const loginValidationSchema = z.object({
  email: z.string().trim().email('Please enter a valid work email').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

export function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('EMPLOYEE'); // 'EMPLOYEE' | 'ADMIN'
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginValidationSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setErrorMessage(null);
    setErrorStatus(null);
    if (tab === 'ADMIN') {
      setValue('email', 'admin@gmail.com');
      setValue('password', 'admin@007');
    } else {
      setValue('email', '');
      setValue('password', '');
    }
  };

  const handleFillAdminCredentials = () => {
    setValue('email', 'admin@gmail.com');
    setValue('password', 'admin@007');
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    setErrorStatus(null);

    try {
      const res = await login(data);
      const user = res?.data?.user;

      if (activeTab === 'ADMIN') {
        if (user?.role !== 'COMPANY_ADMIN') {
          // Non-admin tried to use admin portal
          await logout();
          setErrorStatus('NOT_AN_ADMIN');
          setErrorMessage('This account does not have administrator privileges. Please switch to Employee Login.');
          return;
        }
        // Always direct admins straight to admin panel
        navigate('/admin', { replace: true });
        return;
      }

      // Employee login flow
      if (user?.role === 'COMPANY_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        const from = location.state?.from?.pathname;
        navigate(from || '/dashboard', { replace: true });
      }
    } catch (err) {
      const errorData = err.response?.data?.error;
      const code = errorData?.code || 'LOGIN_ERROR';
      const message = errorData?.message || 'Login failed. Please verify your credentials.';

      setErrorStatus(code);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full shadow-lg border-slate-200 p-8">
        {/* Logo and Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-xs">
            C
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to Your Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'ADMIN'
              ? 'Company administrator dashboard (Approvals, Vehicles & Policy)'
              : 'Access rides, bookings, and organization commute dashboard'}
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => handleTabSwitch('EMPLOYEE')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'EMPLOYEE'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Employee Login
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('ADMIN')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ADMIN'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Login
          </button>
        </div>

        {/* Admin Quick Credentials Hint Banner */}
        {activeTab === 'ADMIN' && (
          <div className="mb-5 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold flex items-center gap-1.5 text-indigo-800">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Default Admin Credentials:
              </p>
              <p className="mt-1 font-mono text-[11px] text-indigo-700">
                Email: <strong>admin@gmail.com</strong>
                <br />
                Password: <strong>admin@007</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillAdminCredentials}
              className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shrink-0 transition"
            >
              Fill Credentials
            </button>
          </div>
        )}

        {/* Status-specific warning or error banner */}
        {errorMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-start space-x-3 mb-6 ${
              errorStatus === 'ACCOUNT_PENDING_APPROVAL'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : errorStatus === 'ACCOUNT_SUSPENDED' || errorStatus === 'ACCOUNT_DEACTIVATED'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {errorStatus === 'ACCOUNT_PENDING_APPROVAL' ? (
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : errorStatus === 'ACCOUNT_SUSPENDED' ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {errorStatus === 'ACCOUNT_PENDING_APPROVAL'
                  ? 'Account Approval Pending'
                  : errorStatus === 'ACCOUNT_SUSPENDED'
                  ? 'Account Suspended'
                  : errorStatus === 'ACCOUNT_DEACTIVATED'
                  ? 'Account Deactivated'
                  : errorStatus === 'NOT_AN_ADMIN'
                  ? 'Access Restricted'
                  : 'Authentication Error'}
              </p>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Work Email"
            type="email"
            placeholder={activeTab === 'ADMIN' ? 'admin@gmail.com' : 'name@company.com'}
            icon={Mail}
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Password <span className="text-rose-500">*</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              icon={Lock}
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant={activeTab === 'ADMIN' ? 'primary' : 'primary'}
              className={`w-full ${activeTab === 'ADMIN' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
              size="lg"
              loading={loading}
            >
              {activeTab === 'ADMIN' ? 'Sign In to Admin Dashboard' : 'Sign In'}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700">
            Register with Organization Code
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage;
