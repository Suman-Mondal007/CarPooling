import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, Users, Repeat, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import MapPicker from '../../components/maps/MapPicker.jsx';
import { useRideDraft } from '../../context/RideDraftContext.jsx';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' }
];

export function FindRidePage() {
  const navigate = useNavigate();
  const { draft, setDraft } = useRideDraft();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [pickup, setPickup] = useState(draft?.findPickup || { address: '', lat: null, lng: null });
  const [drop, setDrop] = useState(draft?.findDrop || { address: '', lat: null, lng: null });
  const [date, setDate] = useState(draft?.findDate || defaultDateStr);
  const [time, setTime] = useState(draft?.findTime || '09:00');
  const [windowMinutes, setWindowMinutes] = useState(draft?.findWindowMinutes || 30);
  const [seats, setSeats] = useState(draft?.findSeats || 1);

  const [isRecurring, setIsRecurring] = useState(draft?.findRecurring?.enabled || false);
  const [selectedDays, setSelectedDays] = useState(draft?.findRecurring?.daysOfWeek || [1, 2, 3, 4, 5]);

  const toggleDay = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleProceed = (e) => {
    e.preventDefault();

    if (!pickup.lat || !pickup.lng || !pickup.address) {
      toast.error('Please specify a valid pickup point');
      return;
    }

    if (!drop.lat || !drop.lng || !drop.address) {
      toast.error('Please specify a valid drop-off point');
      return;
    }

    const searchDraft = {
      findPickup: pickup,
      findDrop: drop,
      findDate: date,
      findTime: time,
      findWindowMinutes: Number(windowMinutes),
      findSeats: Number(seats),
      findRecurring: {
        enabled: isRecurring,
        daysOfWeek: selectedDays
      }
    };

    setDraft(searchDraft);
    navigate('/find-ride/confirm-route');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Find a Carpool Ride</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search verified rides offered by colleagues traveling your commute route.
        </p>
      </div>

      <form onSubmit={handleProceed} className="space-y-6">
        {/* Step 1: Waypoints */}
        <Card>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-base">
            <MapPin className="w-5 h-5 text-teal-600" />
            <span>1. Set Commute Locations</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MapPicker
              label="Pickup Location"
              placeholder="Search pickup area, tech park, or home..."
              pinType="origin"
              value={pickup}
              onChange={setPickup}
              height="250px"
            />

            <MapPicker
              label="Destination (Drop-off)"
              placeholder="Search office campus, branch, or landmark..."
              pinType="destination"
              value={drop}
              onChange={setDrop}
              height="250px"
            />
          </div>
        </Card>

        {/* Step 2: Date, Time & Window */}
        <Card>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-base">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>2. Schedule & Seats Required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input
              label="Date of Travel"
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            <Input
              label="Preferred Departure Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Time Window (Flexibility)
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
              >
                <option value={15}>± 15 mins</option>
                <option value={30}>± 30 mins (Recommended)</option>
                <option value={45}>± 45 mins</option>
                <option value={60}>± 60 mins</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Seats Needed
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Users className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="1"
                  max="4"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Recurring commutates */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-teal-600" /> Recurring weekly search (view multi-day schedules)
              </span>
            </label>

            {isRecurring && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Select Recurring Weekdays:
                </span>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        selectedDays.includes(d.id)
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            size="lg"
            className="flex items-center gap-2 px-8"
          >
            <Search className="w-4 h-4" /> Review Route & Find Rides <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FindRidePage;
