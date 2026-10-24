import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';
import Vehicle from '../src/models/Vehicle.js';
import Ride from '../src/models/Ride.js';
import Trip from '../src/models/Trip.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import { signAccessToken } from '../src/utils/token.js';
import { getPassengerLifecycle } from '../src/utils/lifecycle.js';

describe('Phase 4 Tests: Matching, Booking, Cancellation, My Trips & Concurrency', () => {
  let org;
  let driverUser;
  let driverToken;
  let passenger1;
  let passenger1Token;
  let passenger2;
  let passenger2Token;
  let vehicle;

  beforeEach(async () => {
    await Notification.deleteMany({});
    await Booking.deleteMany({});
    await Trip.deleteMany({});
    await Ride.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});

    org = await Organization.create({
      name: 'Acme Enterprise',
      registrationCode: 'ACME2026',
      settings: {
        autoApproveEmployees: true,
        cancellationCutoffMinutes: 60,
        allowStartWithoutPassengers: false,
        requireVehicleVerification: false
      }
    });

    driverUser = await User.create({
      name: 'Driver Dave',
      email: 'driver.dave@acme.local',
      phone: '+919876500001',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });
    driverToken = signAccessToken({ userId: driverUser._id, role: driverUser.role });

    passenger1 = await User.create({
      name: 'Passenger Pam',
      email: 'pam@acme.local',
      phone: '+919876500002',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });
    passenger1Token = signAccessToken({ userId: passenger1._id, role: passenger1.role });

    passenger2 = await User.create({
      name: 'Passenger Pete',
      email: 'pete@acme.local',
      phone: '+919876500003',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });
    passenger2Token = signAccessToken({ userId: passenger2._id, role: passenger2.role });

    vehicle = await Vehicle.create({
      model: 'Toyota Prius',
      registrationNumber: 'KA01AB9999',
      vehicleType: 'SEDAN',
      seatingCapacity: 5, // driver + 4 passenger seats
      fuelType: 'HYBRID',
      fuelEfficiencyKmpl: 22,
      owner: driverUser._id,
      organization: org._id,
      verificationStatus: 'VERIFIED'
    });
  });

  // Helper to publish a sample ride
  async function publishTestRide(overrides = {}) {
    const departure = overrides.departureAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const ride = await Ride.create({
      organization: org._id,
      driver: driverUser._id,
      vehicle: vehicle._id,
      originAddress: 'Koramangala, Bangalore',
      origin: { type: 'Point', coordinates: [77.6245, 12.9352] },
      destinationAddress: 'Whitefield, Bangalore',
      destination: { type: 'Point', coordinates: [77.7500, 12.9698] },
      // Polyline from Koramangala (77.6245, 12.9352) through Indiranagar (77.6408, 12.9784) to Whitefield (77.7500, 12.9698)
      routeGeometry: {
        type: 'LineString',
        coordinates: [
          [77.6245, 12.9352],
          [77.6300, 12.9500],
          [77.6408, 12.9784],
          [77.7000, 12.9750],
          [77.7500, 12.9698]
        ]
      },
      distanceMeters: 18000,
      durationSeconds: 2400,
      departureAt: departure,
      totalPassengerSeats: overrides.totalPassengerSeats || 3,
      availableSeats: overrides.availableSeats !== undefined ? overrides.availableSeats : (overrides.totalPassengerSeats || 3),
      farePerSeatMinor: overrides.farePerSeatMinor || 10000, // 100 Rs
      status: overrides.status || 'OPEN'
    });

    const trip = await Trip.create({
      ride: ride._id,
      driver: driverUser._id,
      organization: org._id,
      status: overrides.tripStatus || 'SCHEDULED'
    });

    return { ride, trip };
  }

  // 1. Matching & Ride Search
  describe('Matching Service & Search API (GET /api/rides/search)', () => {
    it('matches ride when pickup and drop are near route and pickup comes BEFORE drop', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const departureTime = '09:00';
      const [h, m] = departureTime.split(':').map(Number);
      tomorrow.setHours(h, m, 0, 0);

      await publishTestRide({ departureAt: tomorrow });

      // Passenger wants pickup at Koramangala and drop at Indiranagar (along route direction)
      const res = await request(app)
        .get('/api/rides/search')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .query({
          pickupLat: 12.9360,
          pickupLng: 77.6250,
          dropLat: 12.9780,
          dropLng: 77.6410,
          date: tomorrow.toISOString().split('T')[0],
          time: '09:15',
          windowMinutes: 30,
          seats: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      const match = res.body.data.items[0];
      expect(match.match.score).toBeGreaterThan(50);
      expect(match.driver.name).toBe('Driver Dave');
      expect(match.farePerSeatRupees).toBe(100);
    });

    it('rejects match if pickup is AFTER drop along route direction (wrong direction)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await publishTestRide({ departureAt: tomorrow });

      // Passenger tries to travel backwards: from Whitefield to Koramangala
      const res = await request(app)
        .get('/api/rides/search')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .query({
          pickupLat: 12.9700,
          pickupLng: 77.7500, // Whitefield (destination of ride)
          dropLat: 12.9352,
          dropLng: 77.6245, // Koramangala (origin of ride)
          seats: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it('excludes rides when driver is the searching user (cannot match own ride)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await publishTestRide({ departureAt: tomorrow });

      const res = await request(app)
        .get('/api/rides/search')
        .set('Authorization', `Bearer ${driverToken}`) // Driver searching
        .query({
          pickupLat: 12.9360,
          pickupLng: 77.6250,
          dropLat: 12.9780,
          dropLng: 77.6410
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it('excludes rides from a different organization', async () => {
      const otherOrg = await Organization.create({
        name: 'Other Corp',
        registrationCode: 'OTHER2026'
      });
      const otherUser = await User.create({
        name: 'Other Passenger',
        email: 'other@othercorp.local',
        phone: '+919999999999',
        passwordHash: 'dummy',
        role: 'EMPLOYEE',
        organization: otherOrg._id,
        status: 'ACTIVE'
      });
      const otherToken = signAccessToken({ userId: otherUser._id, role: otherUser.role });

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await publishTestRide({ departureAt: tomorrow });

      const res = await request(app)
        .get('/api/rides/search')
        .set('Authorization', `Bearer ${otherToken}`)
        .query({
          pickupLat: 12.9360,
          pickupLng: 77.6250,
          dropLat: 12.9780,
          dropLng: 77.6410
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it('excludes cancelled or already started rides', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await publishTestRide({ departureAt: tomorrow, status: 'CANCELLED' });

      const res = await request(app)
        .get('/api/rides/search')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .query({
          pickupLat: 12.9360,
          pickupLng: 77.6250,
          dropLat: 12.9780,
          dropLng: 77.6410
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });
  });

  // 2. Booking Tests
  describe('Instant Booking API (POST /api/bookings)', () => {
    it('creates booking atomically and computes fareTotalMinor strictly on server', async () => {
      const { ride } = await publishTestRide({ totalPassengerSeats: 3, farePerSeatMinor: 12000 }); // 120 Rs

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 2,
          // Tampered fare attempted by client - server must ignore this!
          fareTotalMinor: 50,
          fareTotalRupees: 1,
          pickup: { address: 'Koramangala 4th Block', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'Indiranagar 100ft Rd', lat: 12.9784, lng: 77.6408 }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.seats).toBe(2);
      // 2 seats * 12000 minor = 24000 minor (240 Rs)
      expect(res.body.data.fareTotalMinor).toBe(24000);
      expect(res.body.data.fareTotalRupees).toBe(240);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.lifecycle.stepCode).toBe('RIDE_BOOKED');

      // Verify ride available seats decremented atomically
      const updatedRide = await Ride.findById(ride._id);
      expect(updatedRide.availableSeats).toBe(1);

      // Verify notification sent to driver
      const notif = await Notification.findOne({ user: driverUser._id, type: 'BOOKING_CREATED' });
      expect(notif).not.toBeNull();
    });

    it('rejects booking your own offered ride', async () => {
      const { ride } = await publishTestRide();

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${driverToken}`) // Driver booking own ride
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'Origin', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'Dest', lat: 12.9784, lng: 77.6408 }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_BOOK_OWN_RIDE');
    });

    it('rejects duplicate CONFIRMED booking on same ride with 409', async () => {
      const { ride } = await publishTestRide({ totalPassengerSeats: 3 });

      // First booking succeeds
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      // Second booking on same ride by same passenger
      const res2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('DUPLICATE_BOOKING');
    });

    it('rejects overlapping commitment if passenger has another ride at the same time', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { ride: ride1 } = await publishTestRide({ departureAt: departureTime });
      const { ride: ride2 } = await publishTestRide({ departureAt: new Date(departureTime.getTime() + 10 * 60 * 1000) }); // 10 mins apart

      // Book ride1
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride1._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      // Attempt to book ride2 at conflicting time
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride2._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERLAPPING_COMMITMENT');
    });

    it('series booking records per-instance outcomes and handles partial failure', async () => {
      const departureDay1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const departureDay2 = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const { ride: ride1 } = await publishTestRide({ departureAt: departureDay1, totalPassengerSeats: 2 });
      const { ride: ride2 } = await publishTestRide({ departureAt: departureDay2, totalPassengerSeats: 1 });

      const res = await request(app)
        .post('/api/bookings/series')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          bookings: [
            {
              rideId: ride1._id.toString(),
              seats: 1,
              pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
              drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
            },
            {
              rideId: ride2._id.toString(),
              seats: 2, // Only 1 seat available -> should fail for ride2!
              pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
              drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.totalSuccess).toBe(1);
      expect(res.body.data.totalFailed).toBe(1);
      expect(res.body.data.results[0].success).toBe(true);
      expect(res.body.data.results[1].success).toBe(false);
      expect(res.body.data.results[1].error.code).toBe('SEATS_UNAVAILABLE');
    });
  });

  // 3. Cancellation Tests
  describe('Cancellation Rules', () => {
    it('cancels booking, returns seats to ride, and flags lateCancellation when within cutoff', async () => {
      // Departure in 30 minutes (< 60 min cutoff)
      const departureTime = new Date(Date.now() + 30 * 60 * 1000);
      const { ride } = await publishTestRide({ departureAt: departureTime, totalPassengerSeats: 3 });

      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 2,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      const bookingId = bookRes.body.data._id;
      const rideAfterBooking = await Ride.findById(ride._id);
      expect(rideAfterBooking.availableSeats).toBe(1);

      // Cancel booking
      const cancelRes = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${passenger1Token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.lateCancellation).toBe(true);
      expect(cancelRes.body.data.booking.status).toBe('CANCELLED_BY_PASSENGER');

      // Seats returned
      const rideAfterCancel = await Ride.findById(ride._id);
      expect(rideAfterCancel.availableSeats).toBe(3);

      // Double cancellation must be rejected and must NOT return seats twice!
      const doubleCancelRes = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${passenger1Token}`);

      expect(doubleCancelRes.status).toBe(400);
      const rideAfterDoubleCancel = await Ride.findById(ride._id);
      expect(rideAfterDoubleCancel.availableSeats).toBe(3); // Unchanged!
    });
  });

  // 4. Trip Transitions & Privacy
  describe('Trip State Machine & Privacy Controls', () => {
    it('validates trip transitions: SCHEDULED -> STARTED -> COMPLETED', async () => {
      const { ride, trip } = await publishTestRide();

      // Attempting to complete trip before starting must fail
      const completeEarlyRes = await request(app)
        .post(`/api/trips/${trip._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(completeEarlyRes.status).toBe(400);
      expect(completeEarlyRes.body.error.code).toBe('INVALID_TRANSITION');

      // Attempting to start trip without passengers when allowStartWithoutPassengers is false must fail
      const startNoPassRes = await request(app)
        .post(`/api/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(startNoPassRes.status).toBe(400);
      expect(startNoPassRes.body.error.code).toBe('NO_PASSENGERS');

      // Passenger books a seat
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      // Passenger cannot start trip
      const passStartRes = await request(app)
        .post(`/api/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${passenger1Token}`);
      expect(passStartRes.status).toBe(404); // Not driver of trip

      // Driver starts trip successfully
      const startRes = await request(app)
        .post(`/api/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.trip.status).toBe('STARTED');

      // Ride is closed for new bookings
      const rideAfterStart = await Ride.findById(ride._id);
      expect(rideAfterStart.status).toBe('CLOSED');

      // Starting already started trip must fail
      const doubleStartRes = await request(app)
        .post(`/api/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(doubleStartRes.status).toBe(400);

      // Driver completes trip successfully
      const completeRes = await request(app)
        .post(`/api/trips/${trip._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.trip.status).toBe('COMPLETED');

      // Bookings marked COMPLETED with UNPAID payment status
      const booking = await Booking.findOne({ ride: ride._id });
      expect(booking.status).toBe('COMPLETED');
      expect(booking.paymentStatus).toBe('UNPAID');

      // Derived lifecycle after completion
      const lifecycle = getPassengerLifecycle({
        tripStatus: 'COMPLETED',
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus
      });
      expect(lifecycle.stepCode).toBe('PAYMENT_PENDING');
    });

    it('enforces passenger privacy: passenger sees only their booking and other count', async () => {
      const { ride, trip } = await publishTestRide({ totalPassengerSeats: 3 });

      // Two different passengers book
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${passenger2Token}`)
        .send({
          rideId: ride._id.toString(),
          seats: 1,
          pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
          drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
        });

      // Passenger 1 views trip details
      const passRes = await request(app)
        .get(`/api/trips/${trip._id}`)
        .set('Authorization', `Bearer ${passenger1Token}`);

      expect(passRes.status).toBe(200);
      expect(passRes.body.data.isDriver).toBe(false);
      // Passenger only receives own booking and count of other passengers
      expect(passRes.body.data.passengers.myBooking).toBeDefined();
      expect(passRes.body.data.passengers.otherConfirmedPassengersCount).toBe(1);
      expect(passRes.body.data.passengers.length).toBeUndefined(); // Not a full array

      // Driver views trip details -> receives full passenger array
      const driverRes = await request(app)
        .get(`/api/trips/${trip._id}`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(driverRes.status).toBe(200);
      expect(driverRes.body.data.isDriver).toBe(true);
      expect(Array.isArray(driverRes.body.data.passengers)).toBe(true);
      expect(driverRes.body.data.passengers.length).toBe(2);
      expect(driverRes.body.data.passengers[0].passenger.name).toBeDefined();
    });
  });

  // 5. Concurrency Test
  describe('Concurrency & Race Condition Integrity', () => {
    it('under high concurrent load, booked seats never exceed capacity and availableSeats never goes negative', async () => {
      // Create a ride with exactly 3 available seats
      const { ride } = await publishTestRide({ totalPassengerSeats: 3, availableSeats: 3 });

      // Create 10 distinct passengers in the same organization
      const concurrentUsers = [];
      for (let i = 0; i < 10; i++) {
        const u = await User.create({
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@acme.local`,
          phone: `+9198000000${i.toString().padStart(2, '0')}`,
          passwordHash: 'dummy',
          role: 'EMPLOYEE',
          organization: org._id,
          status: 'ACTIVE'
        });
        const token = signAccessToken({ userId: u._id, role: u.role });
        concurrentUsers.push({ user: u, token });
      }

      // Simultaneously fire booking requests for 1 seat each using Promise.all
      const bookingPromises = concurrentUsers.map(({ token }) =>
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            rideId: ride._id.toString(),
            seats: 1,
            pickup: { address: 'A', lat: 12.9352, lng: 77.6245 },
            drop: { address: 'B', lat: 12.9784, lng: 77.6408 }
          })
      );

      const responses = await Promise.all(bookingPromises);

      const successfulBookings = responses.filter((res) => res.status === 201);
      const failedBookings = responses.filter((res) => res.status === 400 && res.body.error?.code === 'SEATS_UNAVAILABLE');

      // Exactly 3 bookings must succeed
      expect(successfulBookings.length).toBe(3);
      // The other 7 must fail cleanly with SEATS_UNAVAILABLE
      expect(failedBookings.length).toBe(7);

      // Verify DB integrity
      const finalRide = await Ride.findById(ride._id);
      expect(finalRide.availableSeats).toBe(0); // Exactly 0, never negative!

      const confirmedBookingsInDb = await Booking.find({ ride: ride._id, status: 'CONFIRMED' });
      expect(confirmedBookingsInDb.length).toBe(3);
    });
  });
});
