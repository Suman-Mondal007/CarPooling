import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldAlert,
  Wallet,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';
import { tripsApi } from '../../api/trips.api.js';
import { paymentsApi } from '../../api/payments.api.js';
import { walletApi } from '../../api/wallet.api.js';
import { authApi } from '../../api/auth.api.js';

export default function PaymentPage() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [trip, setTrip] = useState(null);
  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('WALLET');
  const [simulatedModalOpen, setSimulatedModalOpen] = useState(false);
  const [simulatedOrder, setSimulatedOrder] = useState(null);
  const [cashPending, setCashPending] = useState(false);
  const [pendingCashPaymentId, setPendingCashPaymentId] = useState(null);

  // Stable idempotency key per payment session
  const idempotencyKeyRef = useRef(`pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch trip, user wallet, and user profile concurrently
        const [tripRes, walletRes, profileRes] = await Promise.all([
          tripsApi.getTripById(tripId),
          walletApi.getWallet().catch(() => ({ data: { balanceMinor: 0 } })),
          authApi.getProfile().catch(() => ({ data: {} }))
        ]);

        const tripData = tripRes?.data || tripRes;
        const walletData = walletRes?.data || walletRes;
        const profileUser = profileRes?.data?.user || profileRes?.user;

        setTrip(tripData);
        setWallet(walletData);

        // Pre-select preferred method if configured
        const pref = profileUser?.preferredPaymentMethod;
        if (pref && ['WALLET', 'CARD', 'UPI', 'CASH'].includes(pref)) {
          setSelectedMethod(pref);
        }

        // Find current user's booking in this trip
        const currentUserId = profileUser?._id ? String(profileUser._id) : null;
        let userBooking = tripData?.passengers?.myBooking || null;

        if (!userBooking && Array.isArray(tripData?.bookings)) {
          userBooking = tripData.bookings.find((b) => {
            const pId = b.passenger?._id ? String(b.passenger._id) : (b.passenger ? String(b.passenger) : null);
            return pId && pId === currentUserId && b.status !== 'CANCELLED_BY_PASSENGER';
          }) || tripData.bookings[0] || null;
        }

        if (!userBooking) {
          setError('No eligible booking found for you in this trip.');
          setLoading(false);
          return;
        }

        // Ensure fareTotalMinor is present
        if (userBooking.fareTotalMinor === undefined && userBooking.fareTotalRupees !== undefined) {
          userBooking.fareTotalMinor = Math.round(userBooking.fareTotalRupees * 100);
        }

        setBooking(userBooking);

        // Check if already paid
        if (userBooking.paymentStatus === 'PAID') {
          setError('This booking has already been paid for.');
        } else if (userBooking.paymentStatus === 'PAYMENT_PENDING') {
          // Check if there's a pending cash confirmation
          try {
            const paymentsRes = await paymentsApi.getMyPayments({ role: 'passenger' });
            const items = paymentsRes.data?.items || paymentsRes?.items || [];
            const cashPayment = items.find(
              (p) => (p.booking === userBooking._id || p.booking?._id === userBooking._id) &&
                p.status === 'PENDING_CASH_CONFIRMATION'
            );
            if (cashPayment) {
              setCashPending(true);
              setPendingCashPaymentId(cashPayment._id);
            }
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load trip payment details.');
      } finally {
        setLoading(false);
      }
    }

    if (tripId) {
      loadData();
    }
  }, [tripId]);

  const fareTotalMinor = booking?.fareTotalMinor ?? (booking?.fareTotalRupees ? Math.round(booking.fareTotalRupees * 100) : 0);
  const fareTotalINR = (fareTotalMinor / 100).toFixed(2);
  const walletBalanceMinor = wallet?.balanceMinor || 0;
  const walletBalanceINR = (walletBalanceMinor / 100).toFixed(2);
  const isWalletInsufficient = walletBalanceMinor < fareTotalMinor;

  const handleWalletPay = async () => {
    try {
      setProcessing(true);
      setError(null);

      const res = await paymentsApi.walletPay(
        { bookingId: booking._id },
        idempotencyKeyRef.current
      );

      if (res.success && res.data?.paymentId) {
        navigate(`/payments/${res.data.paymentId}/receipt`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Wallet payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const handleCashPay = async () => {
    try {
      setProcessing(true);
      setError(null);

      const res = await paymentsApi.cashPay({ bookingId: booking._id });
      if (res.success) {
        setCashPending(true);
        setPendingCashPaymentId(res.data?.paymentId);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to request cash payment.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelCash = async () => {
    if (!pendingCashPaymentId) return;
    try {
      setProcessing(true);
      await paymentsApi.cancelCash(pendingCashPaymentId);
      setCashPending(false);
      setPendingCashPaymentId(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to cancel cash request.');
    } finally {
      setProcessing(false);
    }
  };

  const handleOnlinePay = async (method) => {
    try {
      setProcessing(true);
      setError(null);

      const orderRes = await paymentsApi.createOrder(
        { bookingId: booking._id, method },
        idempotencyKeyRef.current
      );

      const orderData = orderRes.data;

      if (orderData.alreadyPaid) {
        navigate(`/payments/${orderData.paymentId}/receipt`);
        return;
      }

      // If simulated mode, show simulated checkout modal
      if (orderData.simulated || !window.Razorpay) {
        setSimulatedOrder(orderData);
        setSimulatedModalOpen(true);
        setProcessing(false);
        return;
      }

      // Real Razorpay Checkout.js
      const options = {
        key: orderData.keyId,
        amount: orderData.amountMinor,
        currency: orderData.currency || 'INR',
        name: 'Carpooling Platform',
        description: `Payment for trip #${String(trip._id).slice(-6)}`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            setProcessing(true);
            const verifyRes = await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            if (verifyRes.success) {
              navigate(`/payments/${verifyRes.data.paymentId}/receipt`);
            }
          } catch (verifyErr) {
            setError(verifyErr.response?.data?.error?.message || 'Payment verification failed.');
            setProcessing(false);
          }
        },
        prefill: {
          name: booking?.passenger?.name || '',
          email: booking?.passenger?.email || ''
        },
        theme: {
          color: '#3b82f6'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (failRes) {
        setError(failRes.error?.description || 'Payment was cancelled or failed.');
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to initialize payment gateway.');
      setProcessing(false);
    }
  };

  const handleSimulatedConfirm = async (outcome = 'SUCCESS') => {
    if (!simulatedOrder) return;
    try {
      setProcessing(true);
      setSimulatedModalOpen(false);

      if (outcome === 'FAILURE') {
        setError('Simulated payment failed as requested.');
        setProcessing(false);
        return;
      }

      const paymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const signature = `sig_sim_${simulatedOrder.orderId}_${paymentId}`;

      const verifyRes = await paymentsApi.verifyPayment({
        razorpay_order_id: simulatedOrder.orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      if (verifyRes.success) {
        navigate(`/payments/${verifyRes.data.paymentId}/receipt`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Verification failed.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-medium">Loading payment details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Test Mode Banner */}
      <div
        id="test-mode-banner"
        className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm"
      >
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 bg-amber-500/20 rounded mr-2">
            Test mode
          </span>
          <span>No real money is processed. All transactions use simulated or sandbox currency.</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/trips/${tripId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Trip Details
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trip Payment</h1>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Total Due</span>
          <span className="text-2xl font-extrabold text-blue-400">₹{fareTotalINR}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Trip & Fare Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Trip Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Pickup</span>
            <p className="text-white font-medium">{booking?.pickupAddress || trip?.ride?.originAddress || 'Origin'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Drop</span>
            <p className="text-white font-medium">{booking?.dropAddress || trip?.ride?.destinationAddress || 'Destination'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Driver</span>
            <p className="text-white font-medium">{trip?.driver?.name || trip?.ride?.driver?.name || 'Assigned Driver'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Seats Reserved</span>
            <p className="text-white font-medium">{booking?.seats || 1} Seat(s)</p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm">
          <span className="text-slate-400">Fare breakdown</span>
          <span className="text-white font-semibold">₹{fareTotalINR} (No platform commission)</span>
        </div>
      </div>

      {/* Cash Pending Card */}
      {cashPending ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <Banknote className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Cash Payment Pending Confirmation</h3>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            You have selected physical cash payment. Please pay <strong className="text-white">₹{fareTotalINR}</strong> directly to the driver upon drop-off. The driver will confirm receipt in their app.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancelCash}
              disabled={processing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              {processing ? 'Cancelling...' : 'Cancel Cash & Switch Method'}
            </button>
            <Link
              to={`/trips/${tripId}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              View Trip
            </Link>
          </div>
        </div>
      ) : (
        /* Payment Method Selector */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-base font-bold text-white">Select Payment Method</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="payment-methods-grid">
            {/* 1. Digital Wallet */}
            <button
              type="button"
              onClick={() => setSelectedMethod('WALLET')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                selectedMethod === 'WALLET'
                  ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Wallet className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Digital Wallet</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    ₹{walletBalanceINR}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Instant internal settlement</p>
              </div>
            </button>

            {/* 2. Card */}
            <button
              type="button"
              onClick={() => setSelectedMethod('CARD')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                selectedMethod === 'CARD'
                  ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              <CreditCard className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-sm block">Debit / Credit Card</span>
                <p className="text-xs text-slate-400 mt-1">Visa, Mastercard, RuPay</p>
              </div>
            </button>

            {/* 3. UPI */}
            <button
              type="button"
              onClick={() => setSelectedMethod('UPI')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                selectedMethod === 'UPI'
                  ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              <QrCode className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-sm block">UPI (VPA / QR)</span>
                <p className="text-xs text-slate-400 mt-1">GPay, PhonePe, Paytm</p>
              </div>
            </button>

            {/* 4. Cash */}
            <button
              type="button"
              onClick={() => setSelectedMethod('CASH')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                selectedMethod === 'CASH'
                  ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Banknote className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-sm block">Physical Cash</span>
                <p className="text-xs text-slate-400 mt-1">Driver confirms receipt</p>
              </div>
            </button>
          </div>

          {/* Insufficient Wallet Warning */}
          {selectedMethod === 'WALLET' && isWalletInsufficient && (
            <div
              id="insufficient-wallet-warning"
              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2.5 text-amber-300">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>
                  Insufficient balance: You have <strong>₹{walletBalanceINR}</strong>, need <strong>₹{fareTotalINR}</strong>.
                </span>
              </div>
              <Link
                to="/wallet"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors"
              >
                Recharge Wallet <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Sandbox Test Credentials Notice for Card/UPI */}
          {(selectedMethod === 'CARD' || selectedMethod === 'UPI') && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium">Sandbox credentials:</p>
                <p className="text-slate-400 mt-0.5">
                  Card: <code className="text-white">4111 1111 1111 1111</code>, expiry any future date, CVV 123 | UPI: <code className="text-white">success@razorpay</code>
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {selectedMethod === 'WALLET' && (
              <button
                type="button"
                id="btn-pay-wallet"
                onClick={handleWalletPay}
                disabled={processing || isWalletInsufficient}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing Wallet Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Pay ₹{fareTotalINR} from Wallet
                  </>
                )}
              </button>
            )}

            {(selectedMethod === 'CARD' || selectedMethod === 'UPI') && (
              <button
                type="button"
                id="btn-pay-online"
                onClick={() => handleOnlinePay(selectedMethod)}
                disabled={processing}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Initializing Gateway...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" /> Pay ₹{fareTotalINR} via {selectedMethod}
                  </>
                )}
              </button>
            )}

            {selectedMethod === 'CASH' && (
              <button
                type="button"
                id="btn-pay-cash"
                onClick={handleCashPay}
                disabled={processing}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Requesting...
                  </>
                ) : (
                  <>
                    <Banknote className="w-5 h-5" /> Request Cash Payment (₹{fareTotalINR})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Simulated Gateway Modal */}
      {simulatedModalOpen && simulatedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                RZP
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Simulated Payment Gateway</h3>
                <span className="text-xs text-amber-400 font-semibold tracking-wider uppercase">Sandbox Mode</span>
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Order ID:</span>
                <span className="text-white font-mono text-xs">{simulatedOrder.orderId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="text-white font-bold">₹{fareTotalINR}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Method:</span>
                <span className="text-white font-medium">{simulatedOrder.method}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Select the simulated gateway response to verify the end-to-end webhook and callback behavior:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSimulatedConfirm('SUCCESS')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Simulate Payment Success
              </button>
              <button
                type="button"
                onClick={() => handleSimulatedConfirm('FAILURE')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-red-400 font-medium rounded-xl text-sm transition-colors"
              >
                Simulate Payment Failure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
