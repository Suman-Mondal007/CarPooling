import React, { useState, useEffect } from 'react';
import { createSupportRequest, getMySupportRequests } from '../../api/admin.api.js';
import { HelpCircle, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const FAQ_ITEMS = [
  { q: 'How do I offer a ride?', a: 'Go to Dashboard → Offer a Ride. Add your vehicle first, then fill in origin, destination, date/time, and available seats. The route will be calculated automatically.' },
  { q: 'How do I find and book a ride?', a: 'Go to Dashboard → Find a Ride. Enter your pickup and destination, select a date and time window, and browse matching rides. Click "Book" to reserve your seats.' },
  { q: 'How does payment work?', a: 'After a trip is completed, the passenger pays via Wallet, Card, UPI, or Cash. All payments are in test/sandbox mode — no real money is processed.' },
  { q: 'Can I cancel a booking?', a: 'Yes, you can cancel before the trip starts. Late cancellations (within the cutoff window) are flagged but still allowed. No cancellation after the trip has started.' },
  { q: 'How is the fare calculated?', a: 'The driver sets a flat fare per seat when offering a ride. Your total fare is fare per seat × number of seats booked.' },
  { q: 'What happens if the driver cancels?', a: 'All passengers are notified and their bookings are automatically cancelled. Seats are released.' },
  { q: 'How do I add or verify my vehicle?', a: 'Go to My Vehicles from the sidebar. Add your vehicle details. If your organization requires verification, a company admin will review and verify it.' },
  { q: 'How do I recharge my wallet?', a: 'Go to Wallet from the sidebar and click Recharge. Choose an amount and complete the payment. In development mode, simulated recharges are available.' }
];

const CATEGORIES = ['ACCOUNT', 'RIDES', 'PAYMENTS', 'VEHICLES', 'TECHNICAL', 'OTHER'];

export default function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', category: 'OTHER' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMySupportRequests()
      .then((res) => setRequests(res.data?.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return toast.error('Please fill all fields');
    setSubmitting(true);
    try {
      await createSupportRequest(form);
      toast.success('Support request submitted');
      setForm({ subject: '', message: '', category: 'OTHER' });
      const res = await getMySupportRequests();
      setRequests(res.data?.data?.items || []);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit request');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <HelpCircle className="w-6 h-6 text-teal-600" /> Help & Support
      </h1>

      {/* FAQ Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
                <span className="text-sm font-medium text-gray-800">{item.q}</span>
                {openFaq === idx ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-3 text-sm text-gray-600 border-t border-gray-50 pt-2">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Support Request Form */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" /> Submit a Request
        </h2>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Brief summary..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={4} placeholder="Describe your issue in detail..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" />
          </div>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition">
            <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </section>

      {/* My Previous Requests */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Requests</h2>
        {loading ? (
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />)}</div>
        ) : requests.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">No support requests yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r._id} className="flex items-start justify-between p-4 bg-white rounded-xl border">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.category} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{r.message}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${r.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
