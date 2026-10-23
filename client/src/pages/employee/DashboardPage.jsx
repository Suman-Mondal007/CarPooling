import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  Calendar,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
              {user?.organization?.name || 'Enterprise'}
            </span>
            <Badge variant="emerald" size="sm">Verified Account</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Colleague'}!
          </h1>
          <p className="text-xs md:text-sm text-teal-100/80 mt-1 max-w-xl leading-relaxed">
            Ready for your daily commute? Choose whether you want to ride along as a passenger or share empty seats as a driver.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-900 flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[11px] text-teal-200 block uppercase font-medium tracking-wider">Wallet Balance</span>
            <span className="text-lg font-bold text-white">₹0.00</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 ml-2"
            onClick={() => navigate('/wallet')}
          >
            Recharge
          </Button>
        </div>
      </div>

      {/* TWO PROMINENT, EQUALLY CLEAR ACTIONS (Find a Ride / Offer a Ride) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <span>Commute Actions</span>
          </h2>
          <span className="text-xs text-slate-500">One account can both drive and ride</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action 1: Find a Ride */}
          <div
            onClick={() => navigate('/find-ride')}
            className="group relative overflow-hidden bg-white p-8 rounded-3xl border-2 border-teal-200 shadow-sm hover:shadow-lg hover:border-teal-600 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors shadow-xs">
                <Search className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 mb-1 block">
                Passenger Commute
              </span>
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                Find / Book a Ride
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Search available rides by pickup, destination, and schedule. View route maps, verified colleague driver profiles, and book instant seats.
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-teal-600 group-hover:underline">
                Explore Available Rides
              </span>
              <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-teal-600 group-hover:text-white transition-all">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Action 2: Offer a Ride */}
          <div
            onClick={() => navigate('/offer-ride')}
            className="group relative overflow-hidden bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-800 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors shadow-xs">
                <PlusCircle className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                Driver Commute
              </span>
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                Offer / Share a Ride
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Driving your personal vehicle? Publish your route, specify departure time, set available passenger seats, and share travel expenses with co-workers.
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-800 group-hover:underline">
                Publish a New Ride
              </span>
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-slate-900 group-hover:text-white transition-all">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Secondary Overview Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upcoming Trips Widget */}
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upcoming Trips</h3>
                <p className="text-[11px] text-slate-500">Your scheduled carpool journeys</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-trips')}>
              View All
            </Button>
          </div>

          <div className="py-8 text-center text-slate-500">
            <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-700">No active or upcoming trips scheduled</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-4">
              Book a seat or offer a ride to see your journey tracking here.
            </p>
            <div className="flex justify-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/find-ride')}>
                Find Ride
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/offer-ride')}>
                Offer Ride
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Organization Info */}
        <Card>
          <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 mb-4">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Organization</h3>
              <p className="text-[11px] text-slate-500">Commute guidelines & policy</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Organization:</span>
              <span className="font-semibold text-slate-800">{user?.organization?.name || 'Verified Org'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Registration Code:</span>
              <span className="font-mono font-semibold text-teal-700">
                {user?.organization?.registrationCode || 'PROTECTED'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Timezone:</span>
              <span className="text-slate-700">{user?.organization?.timezone || 'Asia/Kolkata'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Vehicle Verification:</span>
              <Badge variant="teal" size="sm">Required</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
