/**
 * Analytics Service — Phase 7
 *
 * All figures are computed from stored records. Formulas documented below.
 *
 * === Distance ===
 * Sum of ride.distanceMeters / 1000 (km) for COMPLETED trips.
 *
 * === Fuel Consumption (ESTIMATE) ===
 * For each completed trip with a vehicle:
 *   litres = distanceKm / vehicle.fuelEfficiencyKmpl
 *   (EV vehicles with 0 km/l are excluded from fuel calc)
 *
 * === Fuel Cost (ESTIMATE) ===
 * litres × org.settings.fuelPricePerLitre
 *
 * === Total Travel Cost (ESTIMATE) ===
 * fuelCost + (org.settings.operationalCostPerKm × distanceKm)
 *
 * === Cost Per Km (ESTIMATE) ===
 * totalTravelCost / distanceKm (guarded: 0 when distanceKm == 0)
 *
 * === Passenger-Km ===
 * For each completed booking: seats × (ride.distanceMeters / 1000)
 *
 * === Fuel Per Passenger-Km (ESTIMATE) ===
 * totalFuelLitres / totalPassengerKm (guarded)
 *
 * === Average Occupancy ===
 * sum(booked seats) / sum(offered seats) per trip
 *
 * === CO₂ Saved (ESTIMATE) ===
 * Assumption: 2.31 kg CO₂ per litre of petrol (IPCC value).
 * Passenger trips that replaced solo drives: each booking.seats count as
 * a solo trip avoided. CO₂ saved = avoidedTrips × avgDistanceKm ×
 * (1 / avgFuelEfficiency) × CO2_PER_LITRE.
 * Clearly labeled as an estimate.
 *
 * NOTE: uses org.settings at report time, stated in response metadata.
 */

import Ride from '../models/Ride.js';
import Trip from '../models/Trip.js';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

const CO2_PER_LITRE = 2.31; // kg CO₂ per litre of petrol (IPCC)

/**
 * Organization-level report for admin.
 */
export async function getOrganizationReport(organizationId, from, to, orgSettings) {
  const dateFilter = { $gte: from, $lte: to };

  // All trips in period
  const allTrips = await Trip.find({
    organization: organizationId,
    createdAt: dateFilter
  }).select('ride driver status').lean();

  const completedTrips = allTrips.filter((t) => t.status === 'COMPLETED');
  const cancelledTrips = allTrips.filter((t) => t.status === 'CANCELLED');
  const completedRideIds = completedTrips.map((t) => t.ride);

  // Get rides for completed trips
  const completedRides = await Ride.find({
    _id: { $in: completedRideIds },
    organization: organizationId
  }).select('distanceMeters vehicle vehicleSnapshot totalPassengerSeats departureAt').lean();

  const rideMap = new Map(completedRides.map((r) => [r._id.toString(), r]));

  // All bookings for completed rides
  const allBookings = await Booking.find({
    ride: { $in: completedRideIds },
    organization: organizationId
  }).select('ride seats status fareTotalMinor lateCancellation').lean();

  const completedBookings = allBookings.filter((b) => b.status === 'COMPLETED');
  const cancelledBookings = allBookings.filter((b) =>
    b.status === 'CANCELLED_BY_PASSENGER' || b.status === 'CANCELLED_BY_DRIVER'
  );
  const lateCancellations = cancelledBookings.filter((b) => b.lateCancellation);

  // All bookings across ALL trips (not just completed) in the date range for total counts
  const allTripsRideIds = allTrips.map((t) => t.ride);
  const allPeriodBookings = await Booking.find({
    ride: { $in: allTripsRideIds },
    organization: organizationId
  }).select('seats status').lean();

  const totalBookings = allPeriodBookings.length;
  const totalSeatsShared = completedBookings.reduce((s, b) => s + b.seats, 0);

  // Vehicle info for fuel calculations
  const vehicleIds = [...new Set(completedRides.map((r) => r.vehicle?.toString()).filter(Boolean))];
  const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } }).select('fuelEfficiencyKmpl model registrationNumber vehicleType fuelType').lean();
  const vehicleMap = new Map(vehicles.map((v) => [v._id.toString(), v]));

  // Distance and fuel calculations
  let totalDistanceKm = 0;
  let totalFuelLitres = 0;
  const vehicleStats = new Map(); // vehicleId => { trips, km, litres }

  for (const ride of completedRides) {
    const distKm = (ride.distanceMeters || 0) / 1000;
    totalDistanceKm += distKm;

    const vId = ride.vehicle?.toString();
    const vehicle = vehicleMap.get(vId);
    // Prefer snapshot data for fuel efficiency, fall back to vehicle record
    const fuelEff = ride.vehicleSnapshot?.fuelEfficiencyKmpl || vehicle?.fuelEfficiencyKmpl || 0;
    const litres = fuelEff > 0 ? distKm / fuelEff : 0;
    totalFuelLitres += litres;

    // Vehicle-wise stats
    const vKey = vId || 'unknown';
    const existing = vehicleStats.get(vKey) || { trips: 0, km: 0, litres: 0, model: '', registration: '', fuelType: '' };
    existing.trips += 1;
    existing.km += distKm;
    existing.litres += litres;
    existing.model = ride.vehicleSnapshot?.model || vehicle?.model || 'Unknown';
    existing.registration = ride.vehicleSnapshot?.registrationNumber || vehicle?.registrationNumber || 'Unknown';
    existing.fuelType = ride.vehicleSnapshot?.fuelType || vehicle?.fuelType || 'Unknown';
    vehicleStats.set(vKey, existing);
  }

  // Cost calculations using org settings at report time
  const fuelPricePerLitre = orgSettings.fuelPricePerLitre || 100;
  const operationalCostPerKm = orgSettings.operationalCostPerKm || 0;

  const fuelCost = totalFuelLitres * fuelPricePerLitre;
  const totalTravelCost = fuelCost + (operationalCostPerKm * totalDistanceKm);
  const costPerKm = totalDistanceKm > 0 ? totalTravelCost / totalDistanceKm : 0;

  // Vehicle-wise cost analysis
  const vehicleWiseCost = [];
  for (const [vId, stats] of vehicleStats) {
    const vCost = (stats.litres * fuelPricePerLitre) + (operationalCostPerKm * stats.km);
    vehicleWiseCost.push({
      vehicleId: vId,
      model: stats.model,
      registrationNumber: stats.registration,
      fuelType: stats.fuelType,
      trips: stats.trips,
      distanceKm: Math.round(stats.km * 100) / 100,
      fuelLitres: Math.round(stats.litres * 100) / 100,
      cost: Math.round(vCost),
      costPerKm: stats.km > 0 ? Math.round((vCost / stats.km) * 100) / 100 : 0,
      estimate: true
    });
  }

  // Passenger-km and occupancy
  let totalPassengerKm = 0;
  let totalOfferedSeats = 0;
  let totalBookedSeats = 0;

  for (const booking of completedBookings) {
    const ride = rideMap.get(booking.ride.toString());
    if (ride) {
      totalPassengerKm += booking.seats * ((ride.distanceMeters || 0) / 1000);
    }
  }

  for (const ride of completedRides) {
    totalOfferedSeats += ride.totalPassengerSeats || 0;
    const rideBookedSeats = completedBookings
      .filter((b) => b.ride.toString() === ride._id.toString())
      .reduce((s, b) => s + b.seats, 0);
    totalBookedSeats += rideBookedSeats;
  }

  const avgOccupancy = totalOfferedSeats > 0 ? totalBookedSeats / totalOfferedSeats : 0;
  const fuelPerPassengerKm = totalPassengerKm > 0 ? totalFuelLitres / totalPassengerKm : 0;

  // CO₂ saved estimate
  const avgDistanceKm = completedRides.length > 0 ? totalDistanceKm / completedRides.length : 0;
  const avgFuelEff = totalDistanceKm > 0 ? totalDistanceKm / (totalFuelLitres || 1) : 15;
  const avoidedTrips = totalSeatsShared; // each shared seat = one avoided solo trip
  const co2SavedKg = avoidedTrips * avgDistanceKm * (1 / avgFuelEff) * CO2_PER_LITRE;

  // Monthly fuel per passenger-km trend
  const monthlyTrend = await computeMonthlyTrend(organizationId, from, to);

  // Employee participation
  const totalEmployees = await User.countDocuments({
    organization: organizationId,
    role: 'EMPLOYEE',
    status: { $in: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] }
  });

  const activeDriverIds = [...new Set(completedTrips.map((t) => t.driver.toString()))];
  // Bookings don't have passenger in our initial select, fetch them
  const passengerBookings = await Booking.find({
    ride: { $in: completedRideIds },
    organization: organizationId,
    status: 'COMPLETED'
  }).select('passenger').lean();
  const uniquePassengers = [...new Set(passengerBookings.map((b) => b.passenger.toString()))];
  const allParticipants = new Set([...activeDriverIds, ...uniquePassengers]);

  const participationRate = totalEmployees > 0 ? allParticipants.size / totalEmployees : 0;

  return {
    period: { from, to },
    metadata: {
      fuelPricePerLitre,
      operationalCostPerKm,
      co2PerLitre: CO2_PER_LITRE,
      note: 'Uses organization settings at report generation time. All fuel/cost/CO₂ figures are estimates.'
    },
    summary: {
      totalTrips: allTrips.length,
      completedTrips: completedTrips.length,
      cancelledTrips: cancelledTrips.length,
      lateCancellations: lateCancellations.length,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalBookings,
      totalSeatsShared,
      totalTravelCost: Math.round(totalTravelCost),
      fuelConsumptionLitres: { value: Math.round(totalFuelLitres * 100) / 100, estimate: true },
      costPerKm: { value: Math.round(costPerKm * 100) / 100, estimate: true },
      fuelPerPassengerKm: { value: Math.round(fuelPerPassengerKm * 10000) / 10000, estimate: true },
      avgOccupancy: Math.round(avgOccupancy * 10000) / 10000,
      co2SavedKg: { value: Math.round(co2SavedKg * 100) / 100, estimate: true, assumption: `${CO2_PER_LITRE} kg CO₂ per litre; each shared seat replaces one solo trip` },
      participation: {
        totalEmployees,
        activeDrivers: activeDriverIds.length,
        activePassengers: uniquePassengers.length,
        totalParticipants: allParticipants.size,
        participationRate: Math.round(participationRate * 10000) / 10000
      }
    },
    vehicleWiseCost,
    monthlyTrend
  };
}

/**
 * Employee personal report
 */
export async function getEmployeeReport(userId, organizationId, from, to, orgSettings) {
  const dateFilter = { $gte: from, $lte: to };

  // Trips as driver
  const driverTrips = await Trip.find({
    driver: userId,
    organization: organizationId,
    createdAt: dateFilter
  }).select('ride status').lean();

  const completedDriverTrips = driverTrips.filter((t) => t.status === 'COMPLETED');
  const driverRideIds = completedDriverTrips.map((t) => t.ride);

  const driverRides = await Ride.find({
    _id: { $in: driverRideIds }
  }).select('distanceMeters vehicleSnapshot vehicle').lean();

  let driverDistanceKm = 0;
  let driverFuelLitres = 0;

  for (const ride of driverRides) {
    const distKm = (ride.distanceMeters || 0) / 1000;
    driverDistanceKm += distKm;
    const fuelEff = ride.vehicleSnapshot?.fuelEfficiencyKmpl || 0;
    if (fuelEff > 0) driverFuelLitres += distKm / fuelEff;
  }

  const fuelPricePerLitre = orgSettings.fuelPricePerLitre || 100;
  const driverFuelCost = driverFuelLitres * fuelPricePerLitre;

  // Bookings as passenger
  const passengerBookings = await Booking.find({
    passenger: userId,
    organization: organizationId,
    createdAt: dateFilter
  }).select('ride seats status fareTotalMinor').lean();

  const completedPassengerBookings = passengerBookings.filter((b) => b.status === 'COMPLETED');
  const passengerRideIds = completedPassengerBookings.map((b) => b.ride);
  const passengerRides = await Ride.find({ _id: { $in: passengerRideIds } })
    .select('distanceMeters').lean();
  const passengerRideMap = new Map(passengerRides.map((r) => [r._id.toString(), r]));

  let passengerDistanceKm = 0;
  for (const b of completedPassengerBookings) {
    const ride = passengerRideMap.get(b.ride.toString());
    if (ride) passengerDistanceKm += ((ride.distanceMeters || 0) / 1000);
  }

  // Payments
  const paidPayments = await Payment.find({
    passenger: userId,
    organization: organizationId,
    status: 'PAID',
    createdAt: dateFilter
  }).select('amountMinor').lean();
  const amountSpent = paidPayments.reduce((s, p) => s + p.amountMinor, 0);

  const earnedPayments = await Payment.find({
    driver: userId,
    organization: organizationId,
    status: 'PAID',
    createdAt: dateFilter
  }).select('amountMinor').lean();
  const amountEarned = earnedPayments.reduce((s, p) => s + p.amountMinor, 0);

  // Cost saved estimate: if a passenger took a solo trip the distance
  // at average fuel consumption, they would have spent more
  const avgEfficiency = 15; // assumed average km/l for a solo car
  const soloFuelCost = passengerDistanceKm > 0
    ? (passengerDistanceKm / avgEfficiency) * fuelPricePerLitre
    : 0;
  const costSaved = Math.max(0, soloFuelCost - amountSpent);

  return {
    period: { from, to },
    metadata: {
      fuelPricePerLitre,
      note: 'Uses organization settings at report time. Fuel/cost figures are estimates.'
    },
    asDriver: {
      totalTrips: driverTrips.length,
      completedTrips: completedDriverTrips.length,
      distanceKm: Math.round(driverDistanceKm * 100) / 100,
      fuelLitres: { value: Math.round(driverFuelLitres * 100) / 100, estimate: true },
      fuelCost: { value: Math.round(driverFuelCost), estimate: true },
      amountEarnedMinor: amountEarned,
      amountEarnedRupees: amountEarned / 100
    },
    asPassenger: {
      totalBookings: passengerBookings.length,
      completedBookings: completedPassengerBookings.length,
      distanceKm: Math.round(passengerDistanceKm * 100) / 100,
      amountSpentMinor: amountSpent,
      amountSpentRupees: amountSpent / 100,
      costSaved: { value: Math.round(costSaved), estimate: true, assumption: 'Compared to solo driving at 15 km/l average' }
    }
  };
}

/**
 * Monthly trend: fuel per passenger-km + occupancy, month by month.
 */
async function computeMonthlyTrend(organizationId, from, to) {
  const trips = await Trip.find({
    organization: organizationId,
    status: 'COMPLETED',
    createdAt: { $gte: from, $lte: to }
  }).select('ride createdAt').lean();

  if (trips.length === 0) return [];

  const rideIds = trips.map((t) => t.ride);
  const rides = await Ride.find({ _id: { $in: rideIds } })
    .select('distanceMeters vehicleSnapshot totalPassengerSeats vehicle').lean();
  const rideMap = new Map(rides.map((r) => [r._id.toString(), r]));

  const bookings = await Booking.find({
    ride: { $in: rideIds },
    status: 'COMPLETED'
  }).select('ride seats').lean();

  // Group by month
  const months = new Map();
  for (const trip of trips) {
    const d = new Date(trip.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) {
      months.set(key, { fuelLitres: 0, passengerKm: 0, bookedSeats: 0, offeredSeats: 0 });
    }
    const m = months.get(key);
    const ride = rideMap.get(trip.ride.toString());
    if (!ride) continue;
    const distKm = (ride.distanceMeters || 0) / 1000;
    const fuelEff = ride.vehicleSnapshot?.fuelEfficiencyKmpl || 0;
    if (fuelEff > 0) m.fuelLitres += distKm / fuelEff;
    m.offeredSeats += ride.totalPassengerSeats || 0;

    const rideBookings = bookings.filter((b) => b.ride.toString() === ride._id.toString());
    const seats = rideBookings.reduce((s, b) => s + b.seats, 0);
    m.bookedSeats += seats;
    m.passengerKm += seats * distKm;
  }

  const trend = [];
  for (const [month, data] of [...months.entries()].sort()) {
    trend.push({
      month,
      fuelPerPassengerKm: data.passengerKm > 0 ? Math.round((data.fuelLitres / data.passengerKm) * 10000) / 10000 : 0,
      avgOccupancy: data.offeredSeats > 0 ? Math.round((data.bookedSeats / data.offeredSeats) * 10000) / 10000 : 0,
      fuelLitres: Math.round(data.fuelLitres * 100) / 100,
      passengerKm: Math.round(data.passengerKm * 100) / 100,
      estimate: true
    });
  }
  return trend;
}

/**
 * Admin dashboard summary counts.
 */
export async function getAdminSummary(organizationId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [pendingApprovals, pendingVehicles, activeRidesToday, tripsThisMonth] = await Promise.all([
    User.countDocuments({ organization: organizationId, status: 'PENDING_APPROVAL', role: 'EMPLOYEE' }),
    Vehicle.countDocuments({ organization: organizationId, verificationStatus: 'PENDING', isDeleted: false }),
    Ride.countDocuments({
      organization: organizationId,
      status: 'OPEN',
      departureAt: { $gte: startOfDay, $lt: endOfDay }
    }),
    Trip.countDocuments({
      organization: organizationId,
      createdAt: { $gte: startOfMonth, $lt: endOfMonth }
    })
  ]);

  return { pendingApprovals, pendingVehicles, activeRidesToday, tripsThisMonth };
}

export default {
  getOrganizationReport,
  getEmployeeReport,
  getAdminSummary
};
