import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Card from '../../components/common/Card.jsx';

const loginValidationSchema = z.object({
  email: z.string().trim().email('Please enter a valid work email').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginValidationSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    setErrorStatus(null);

    try {
      const res = await login(data);
      const user = res?.data?.user;

      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user?.role === 'COMPANY_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
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
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-xs">
            C
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to Your Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access rides, bookings, and organization commute dashboard
          </p>
        </div>

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
            placeholder="name@company.com"
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
              variant="primary"
              className="w-full"
              size="lg"
              loading={loading}
            >
              Sign In
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
