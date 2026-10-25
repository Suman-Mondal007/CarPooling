import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Printer,
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  CreditCard,
  Wallet,
  QrCode,
  Banknote,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { paymentsApi } from '../../api/payments.api.js';

export default function ReceiptPage() {
  const { id: paymentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    async function loadReceipt() {
      try {
        setLoading(true);
        setError(null);
        const res = await paymentsApi.getPaymentById(paymentId);
        setPayment(res.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load payment receipt.');
      } finally {
        setLoading(false);
      }
    }

    if (paymentId) {
      loadReceipt();
    }
  }, [paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-medium">Loading receipt...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Receipt Unavailable</h2>
        <p className="text-sm text-slate-400">{error || 'Receipt not found.'}</p>
        <Link
          to="/my-trips"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Trips
        </Link>
      </div>
    );
  }

  const amountINR = ((payment.amountMinor || 0) / 100).toFixed(2);
  const paidAt = payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A';
  const trip = payment.trip;
  const ride = trip?.ride;

  const renderMethodIcon = (method) => {
    switch (method) {
      case 'WALLET':
        return <Wallet className="w-4 h-4 text-blue-400" />;
      case 'CARD':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'UPI':
        return <QrCode className="w-4 h-4 text-purple-400" />;
      case 'CASH':
        return <Banknote className="w-4 h-4 text-amber-400" />;
      default:
        return <CreditCard className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Test Mode Banner */}
      <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs print:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Test mode sandbox receipt - No real monetary value.</span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </button>
      </div>

      {/* Printable Receipt Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-slate-800 print:border-slate-300 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                CP
              </div>
              <h1 className="text-xl font-black tracking-tight text-white print:text-black">
                Payment Receipt
              </h1>
            </div>
            <p className="text-xs text-slate-400 print:text-slate-600">Enterprise Carpooling Platform</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider print:text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {payment.status}
            </span>
            <p className="text-xs text-slate-500 print:text-slate-600 font-mono mt-1">
              #{payment._id}
            </p>
          </div>
        </div>

        {/* Big Amount Callout */}
        <div className="bg-slate-950/60 print:bg-slate-100 rounded-2xl p-6 text-center space-y-1">
          <span className="text-xs text-slate-400 print:text-slate-600 uppercase tracking-widest font-semibold">
            Amount Paid
          </span>
          <div className="text-4xl font-extrabold text-white print:text-black tracking-tight">
            ₹{amountINR}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 print:text-slate-600 pt-1">
            {renderMethodIcon(payment.method)}
            <span className="font-medium">Paid via {payment.method}</span>
          </div>
        </div>

        {/* Breakdown & Metadata */}
        <div className="space-y-4 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-800/80 print:border-slate-200">
            <span className="text-slate-400 print:text-slate-600">Payment Date & Time</span>
            <span className="font-medium text-white print:text-black flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" /> {paidAt}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/80 print:border-slate-200">
            <span className="text-slate-400 print:text-slate-600">Passenger (Payer)</span>
            <span className="font-medium text-white print:text-black flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-500" /> {payment.passenger?.name || 'Passenger'}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/80 print:border-slate-200">
            <span className="text-slate-400 print:text-slate-600">Trip Driver</span>
            <span className="font-medium text-white print:text-black flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-500" /> {payment.driver?.name || 'Driver'}
            </span>
          </div>

          {payment.razorpayPaymentId && (
            <div className="flex justify-between py-2 border-b border-slate-800/80 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600">Gateway Transaction ID</span>
              <span className="font-mono text-xs text-blue-400 print:text-blue-700">
                {payment.razorpayPaymentId}
              </span>
            </div>
          )}

          {payment.idempotencyKey && (
            <div className="flex justify-between py-2 border-b border-slate-800/80 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600">Reference Key</span>
              <span className="font-mono text-xs text-slate-400 print:text-slate-600">
                {payment.idempotencyKey}
              </span>
            </div>
          )}
        </div>

        {/* Route Info */}
        <div className="bg-slate-800/40 print:bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
          <span className="font-semibold text-slate-300 print:text-slate-700 block">Commute Route</span>
          <div className="space-y-1 text-slate-400 print:text-slate-600">
            <p>
              <strong className="text-white print:text-black">From:</strong> {ride?.originAddress || 'Origin'}
            </p>
            <p>
              <strong className="text-white print:text-black">To:</strong> {ride?.destinationAddress || 'Destination'}
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 print:text-slate-400 pt-2">
          Thank you for carpooling and reducing your carbon footprint!
        </div>
      </div>

      {/* Back button */}
      <div className="text-center print:hidden">
        <Link
          to={`/trips/${trip?._id || ''}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Trip Details
        </Link>
      </div>
    </div>
  );
}
