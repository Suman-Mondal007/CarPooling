import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  ShieldCheck,
  Leaf,
  PiggyBank,
  MapPin,
  Clock,
  ArrowRight
} from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isCompanyAdmin } = useAuth();

  const handleAction = (path) => {
    if (isAuthenticated) {
      navigate(isCompanyAdmin ? '/admin' : path);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(path)}`);
    }
  };

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-linear-to-b from-teal-50/50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 mb-6">
              <Leaf className="w-3.5 h-3.5 text-teal-600" />
              <span>Smart & Sustainable Workplace Commuting</span>
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              Share the Drive, <span className="text-teal-600">Cut the Carbon</span>, Connect with Colleagues.
            </h1>

            <p className="text-base md:text-lg text-slate-600 mb-10 leading-relaxed">
              An enterprise platform exclusively for verified employees. Coordinate carpooling schedules,
              track trips in real-time, share commute costs, and reduce your carbon footprint every single day.
            </p>

            {/* Two Prominent Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              <div
                onClick={() => handleAction('/find-ride')}
                className="group p-6 rounded-2xl bg-white border border-teal-200 shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                    Find a Ride
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Discover co-workers traveling along your route and reserve passenger seats instantly.
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                  <span>Search Rides</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              <div
                onClick={() => handleAction('/offer-ride')}
                className="group p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-800 transition-all text-left cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-800 transition-colors">
                    Offer a Ride
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Driving to work? Publish your empty seats, share fuel expenses, and reduce traffic.
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-slate-800 group-hover:translate-x-1 transition-transform">
                  <span>Publish Offer</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">How It Works</h2>
          <p className="text-sm text-slate-600 mt-2">
            Seamless workplace carpooling built right into your daily office routine in 4 simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Register With Org Code',
              desc: 'Join your organization using a secure corporate registration code. Every user is a verified employee.',
              icon: ShieldCheck
            },
            {
              step: '02',
              title: 'Confirm Your Route',
              desc: 'Select pickup and drop points with interactive map routing, distance preview, and schedule options.',
              icon: MapPin
            },
            {
              step: '03',
              title: 'Match & Ride Together',
              desc: 'Book instant seats, track driver location in real time via live WebSockets, and chat en route.',
              icon: Clock
            },
            {
              step: '04',
              title: 'Pay & Track Savings',
              desc: 'Settle trip fares securely via Wallet, UPI, or Card post-completion and view CO₂ metrics.',
              icon: PiggyBank
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card key={idx} className="relative overflow-hidden border-slate-200">
                <span className="text-4xl font-black text-slate-100 absolute -top-1 right-3 select-none">
                  {item.step}
                </span>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Illustrative Statistics & Benefits */}
      <section id="sustainability" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mb-10">
            <span className="text-xs text-teal-400 font-semibold uppercase tracking-wider block mb-2">
              Measurable Impact
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Driving Sustainability & Commute Efficiency
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              Real-time trip completion data computes fuel efficiency and cost reductions for every organization.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-teal-400">45%*</div>
              <p className="text-sm font-semibold text-slate-200 mt-1">Average Cost Savings</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Shared fuel expenses vs single-occupancy driving</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-emerald-400">1.8 kg*</div>
              <p className="text-sm font-semibold text-slate-200 mt-1">CO₂ Prevented Per Trip</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Based on average 15 km round-trip occupancy</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-teal-300">100%</div>
              <p className="text-sm font-semibold text-slate-200 mt-1">Verified Colleagues</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tenant-isolated organization carpooling</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-8">
            * Note: Statistics are illustrative projections. Actual environmental and cost calculations are generated dynamically from verified vehicle fuel efficiency and logged distance records.
          </p>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-teal-50 border border-teal-200/80 rounded-3xl p-10 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Ready to upgrade your daily commute?
          </h3>
          <p className="text-xs text-slate-600 mb-6 max-w-md mx-auto">
            Ask your office admin for your corporate registration code and register today.
          </p>
          <div className="flex justify-center space-x-3">
            <Button variant="primary" onClick={() => navigate('/register')}>
              Register as Employee
            </Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
