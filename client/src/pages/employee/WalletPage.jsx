import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { walletApi } from '../../api/wallet.api.js';
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx';

const PRESET_AMOUNTS = [100, 200, 500, 1000];

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalTxs, setTotalTxs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [error, setError] = useState(null);

  // Recharge Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);
  const [customInput, setCustomInput] = useState('500');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await walletApi.getWallet();
      setWallet(res.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch wallet balance');
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = { page, limit: 10 };
      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }
      const res = await walletApi.getTransactions(params);
      setTransactions(res.data?.items || []);
      setTotalTxs(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch transactions');
    }
  }, [page, typeFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchWallet(), fetchTransactions()]);
    setLoading(false);
  }, [fetchWallet, fetchTransactions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handlePresetClick = (amount) => {
    setRechargeAmount(amount);
    setCustomInput(String(amount));
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomInput(val);
    setRechargeAmount(Number(val) || 0);
  };

  const handleSimulatedRecharge = async () => {
    if (rechargeAmount < 10 || rechargeAmount > 10000) {
      setError('Recharge amount must be between ₹10 and ₹10,000');
      return;
    }

    try {
      setRechargeLoading(true);
      setError(null);
      const amountMinor = rechargeAmount * 100;
      const res = await walletApi.simulateRecharge(amountMinor);
      if (res.success) {
        setRechargeSuccess(`Successfully recharged ₹${rechargeAmount} to your wallet!`);
        await fetchWallet();
        await fetchTransactions();
        setTimeout(() => {
          setIsModalOpen(false);
          setRechargeSuccess(null);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Recharge failed.');
    } finally {
      setRechargeLoading(false);
    }
  };

  const balanceINR = ((wallet?.balanceMinor || 0) / 100).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Test Mode Banner */}
      <div
        id="test-mode-banner"
        className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm"
      >
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 bg-amber-500/20 rounded mr-2">
            Test mode
          </span>
          <span>
            This is a digital test wallet. No real money or bank accounts are debited.
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Digital Wallet</h1>
          <p className="text-sm text-slate-400">
            Manage your commute balance, driver earnings, and recharge ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Refresh balance"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            id="btn-recharge-modal"
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-600/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Recharge Wallet
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Balance Card & Driver Earnings summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Balance */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-400" /> Available Balance
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
              INR (₹)
            </span>
          </div>

          <div className="flex items-baseline gap-1 my-4">
            <span className="text-slate-400 text-2xl font-semibold">₹</span>
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight" id="wallet-balance-display">
              <AnimatedNumber
                value={Number(balanceINR)}
                formatter={() => balanceINR}
              />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400 border-t border-slate-800/80">
            <span>Atomic Single-Document Ledger</span>
            <span>•</span>
            <span>Zero Platform Fees</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setRechargeAmount(500);
                setCustomInput('500');
                handleSimulatedRecharge();
              }}
              disabled={rechargeLoading}
              className="ml-auto inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" /> Instant +₹500 Sandbox
            </button>
          </div>
        </div>

        {/* Driver Earnings Info Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Car className="w-4 h-4" /> Driver Earnings
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Stored in Wallet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When you offer a ride, passenger fares are credited in full directly into this wallet.
            </p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 mt-4">
            Withdrawals are disabled in this test sandbox demo. Earnings can be reused for passenger trips.
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-bold text-white">Transaction Ledger</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {totalTxs}
            </span>
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'RECHARGE', 'PAYMENT', 'EARNING'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase() + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Items */}
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Wallet className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">No transactions found in this view.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'RECHARGE' || tx.type === 'EARNING';
              const amtINR = (tx.amountMinor / 100).toFixed(2);
              const afterINR = (tx.balanceAfterMinor / 100).toFixed(2);
              const dateStr = new Date(tx.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
              });

              return (
                <div
                  key={tx._id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/60 hover:bg-slate-800/40 border border-slate-800/80 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'RECHARGE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : tx.type === 'EARNING'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {tx.type === 'RECHARGE'
                            ? 'Wallet Recharge'
                            : tx.type === 'EARNING'
                            ? 'Trip Driver Earning'
                            : 'Trip Fare Payment'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {tx.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{tx.description || dateStr}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold ${
                        isCredit ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₹{amtINR}
                    </span>
                    <span className="text-xs text-slate-500 block font-mono">
                      Bal: ₹{afterINR}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-medium transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recharge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Recharge Wallet</h3>
                  <span className="text-xs text-slate-400">Sandbox Test Mode</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {rechargeSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold">{rechargeSuccess}</span>
              </div>
            ) : (
              <>
                {/* Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Select Preset Amount
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handlePresetClick(amt)}
                        className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                          rechargeAmount === amt
                            ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                            : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Or Enter Custom Amount (₹10 – ₹10,000)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="text"
                      id="custom-recharge-input"
                      value={customInput}
                      onChange={handleCustomChange}
                      className="w-full pl-8 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    id="btn-confirm-simulated-recharge"
                    onClick={handleSimulatedRecharge}
                    disabled={rechargeLoading || rechargeAmount < 10 || rechargeAmount > 10000}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    {rechargeLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Recharging...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-5 h-5" /> Recharge ₹{rechargeAmount}
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-500">
                    Test Mode: Funds are instantly added via atomic database ledger update.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
