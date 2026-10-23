import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import authApi from '../../api/auth.api.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Card from '../../components/common/Card.jsx';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ['confirmPassword']
  });

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  const onSubmit = async (data) => {
    if (!token) {
      setErrorMessage('Reset token is missing from the link. Please request a new password reset link.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await authApi.resetPassword({
        token,
        password: data.password,
        confirmPassword: data.confirmPassword
      });
      setSuccess(true);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error?.message ||
          'Failed to reset password. The link may have expired or already been used.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full shadow-lg border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xl mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Set New Password</h2>
          <p className="text-xs text-slate-500 mt-1">
            {email ? `Updating credentials for ${email}` : 'Enter your new secure account password'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl text-xs bg-rose-50 text-rose-700 border border-rose-200 mb-6">
            <span className="font-semibold">Error:</span> {errorMessage}
          </div>
        )}

        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-start space-x-3 text-left">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-semibold mb-0.5">Password Successfully Reset!</p>
                <p>You can now sign in using your updated password.</p>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              icon={ArrowRight}
              onClick={() => navigate('/login')}
            >
              Proceed to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              icon={Lock}
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter password"
              icon={Lock}
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                size="lg"
                loading={loading}
              >
                Reset Password
              </Button>
            </div>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel and return to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
