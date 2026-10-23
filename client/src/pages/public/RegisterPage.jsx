import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Mail,
  Phone,
  Lock,
  Building,
  BadgeCheck,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Card from '../../components/common/Card.jsx';

const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;

const registerValidationSchema = z
  .object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().email('Please enter a valid work email').toLowerCase(),
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit Indian phone number (e.g. 9876543210 or +919876543210)'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
    registrationCode: z.string().trim().min(3, 'Organization registration code is required').toUpperCase(),
    employeeId: z.string().trim().optional(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms of Service & Privacy Policy' })
    })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ['confirmPassword']
  });

export function RegisterPage() {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerValidationSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      registrationCode: '',
      employeeId: '',
      agreeToTerms: false
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await registerAuth({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        confirmPassword: data.confirmPassword,
        registrationCode: data.registrationCode,
        employeeId: data.employeeId,
        agreeToTerms: true
      });

      setRegistrationSuccess({
        status: res.data.status,
        message: res.data.message,
        user: res.data.user
      });
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message ||
        'Registration could not be completed. Please check your information.';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // If registered successfully, show confirmation screen
  if (registrationSuccess) {
    const isPending = registrationSuccess.status === 'PENDING_APPROVAL';

    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md w-full shadow-lg border-slate-200 p-8 text-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isPending ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isPending ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            {isPending ? 'Registration Submitted' : 'Registration Complete!'}
          </h2>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {registrationSuccess.message}
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-xs space-y-1.5 border border-slate-200">
            <div>
              <span className="text-slate-400">Account:</span>{' '}
              <span className="font-semibold text-slate-800">{registrationSuccess.user?.email}</span>
            </div>
            <div>
              <span className="text-slate-400">Organization:</span>{' '}
              <span className="font-semibold text-slate-800">
                {registrationSuccess.user?.organization?.name || 'Verified Organization'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Account Status:</span>{' '}
              <span
                className={`font-semibold ${
                  isPending ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {registrationSuccess.status}
              </span>
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
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-xl w-full shadow-lg border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-xs">
            C
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create Employee Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Join your organization&apos;s verified carpooling network
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl text-xs bg-rose-50 text-rose-700 border border-rose-200 mb-6">
            <span className="font-semibold">Registration Error:</span> {errorMessage}
          </div>
        )}

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="e.g. Priya Sharma"
              icon={User}
              required
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.com"
              icon={Mail}
              required
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              placeholder="+919876543210"
              icon={Phone}
              required
              helperText="Indian 10-digit number"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Employee ID (Optional)"
              placeholder="e.g. EMP-101"
              icon={BadgeCheck}
              error={errors.employeeId?.message}
              {...register('employeeId')}
            />
          </div>

          {/* Organization Registration Code */}
          <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-200/80">
            <Input
              label="Organization Registration Code"
              placeholder="e.g. ACME2026"
              icon={Building}
              required
              className="uppercase tracking-wider font-mono font-semibold"
              helperText="Obtain this code from your office transportation or HR administrator."
              error={errors.registrationCode?.message}
              {...register('registrationCode')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              icon={Lock}
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              icon={Lock}
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                {...register('agreeToTerms')}
              />
              <span>
                I agree to the <a href="#terms" className="text-teal-600 underline">Terms of Service</a>,{' '}
                <a href="#privacy" className="text-teal-600 underline">Privacy Policy</a>, and verify that all information provided is accurate.
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{errors.agreeToTerms.message}</p>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              loading={loading}
            >
              Submit Registration
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700">
            Sign In here
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default RegisterPage;
