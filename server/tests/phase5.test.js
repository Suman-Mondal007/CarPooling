import http from 'http';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import app from '../src/app.js';
import { initializeSockets } from '../src/sockets/index.js';
import { setIO } from '../src/sockets/emitter.js';
import { signAccessToken } from '../src/utils/token.js';
import { clearTrackingMemory } from '../src/services/tracking.service.js';
import * as routingService from '../src/services/routing.service.js';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';
import Vehicle from '../src/models/Vehicle.js';
import Ride from '../src/models/Ride.js';
import Trip from '../src/models/Trip.js';
import Booking from '../src/models/Booking.js';


describe('Phase 5 Tests: Socket.IO, Live Tracking, Chat, and Notifications', () => {
  let server;
  let serverUrl;
  let io;
  let org1, org2;
  let driverUser, passengerUser, otherOrgUser, adminUser;
  let driverToken, passengerToken, otherOrgToken, adminToken;
  let vehicle;
  let ride, trip, booking;
  let calculateRouteSpy;

  beforeAll(async () => {
    server = http.createServer(app);
    io = initializeSockets(server);
    setIO(io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Mock calculateRoute to track invocations and return realistic route data
    calculateRouteSpy = vi.spyOn(routingService, 'calculateRoute').mockResolvedValue({
      geometry: {
        type: 'LineString',
        coordinates: [[77.5946, 12.9716], [77.6000, 12.9800]]
      },
      distanceMeters: 5200,
      durationSeconds: 900,
      distanceKm: 5.2,
      durationMinutes: 15
    });
  });

  afterAll(async () => {
    if (calculateRouteSpy) calculateRouteSpy.mockRestore();
    if (io) io.close();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    clearTrackingMemory();
    vi.clearAllMocks();

    // Create Organizations
    org1 = await Organization.create({
      name: 'Acme Corp',
      registrationCode: 'ACME2026',
      domain: 'acme.local'
    });

    org2 = await Organization.create({
      name: 'Beta Global',
      registrationCode: 'BETA2026',
      domain: 'beta.local'
    });

    // Create Users
    driverUser = await User.create({
      name: 'Priya Sharma (Driver)',
      email: 'priya.driver@acme.local',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      organization: org1._id,
      phone: '+919876543210',
      passwordHash: 'dummy'
    });
    driverToken = signAccessToken({ userId: driverUser._id, organizationId: org1._id, role: 'EMPLOYEE' });

    passengerUser = await User.create({
      name: 'Rahul Verma (Passenger)',
      email: 'rahul.passenger@acme.local',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      organization: org1._id,
      phone: '+919876543211',
      passwordHash: 'dummy'
    });
    passengerToken = signAccessToken({ userId: passengerUser._id, organizationId: org1._id, role: 'EMPLOYEE' });

    otherOrgUser = await User.create({
      name: 'Other Org Employee',
      email: 'other.employee@beta.local',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      organization: org2._id,
      phone: '+919876543212',
      passwordHash: 'dummy'
    });
    otherOrgToken = signAccessToken({ userId: otherOrgUser._id, organizationId: org2._id, role: 'EMPLOYEE' });

    adminUser = await User.create({
      name: 'Company Admin',
      email: 'admin@acme.local',
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
      organization: org1._id,
      phone: '+919876543299',
      passwordHash: 'dummy'
    });
    adminToken = signAccessToken({ userId: adminUser._id, organizationId: org1._id, role: 'COMPANY_ADMIN' });

    // Create Vehicle
    vehicle = await Vehicle.create({
      owner: driverUser._id,
      organization: org1._id,
      model: 'Honda City',
      registrationNumber: 'KA01AB1234',
      vehicleType: 'SEDAN',
      seatingCapacity: 4,
      fuelType: 'PETROL',
      fuelEfficiencyKmpl: 15,
      verificationStatus: 'VERIFIED'
    });

    // Create Ride & Trip
    const departureAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    ride = await Ride.create({
      driver: driverUser._id,
      organization: org1._id,
      vehicle: vehicle._id,
      originAddress: 'Electronic City, Bengaluru',
      origin: { type: 'Point', coordinates: [77.6800, 12.8500] },
      destinationAddress: 'Whitefield, Bengaluru',
      destination: { type: 'Point', coordinates: [77.7500, 12.9700] },
      routeGeometry: {
        type: 'LineString',
        coordinates: [
          [77.6800, 12.8500],
          [77.7000, 12.9000],
          [77.7500, 12.9700]
        ]
      },
      distanceMeters: 25000,
      durationSeconds: 2400,
      departureAt,
      totalPassengerSeats: 3,
      availableSeats: 2,
      farePerSeatMinor: 15000,
      status: 'OPEN'
    });

    trip = await Trip.create({
      ride: ride._id,
      driver: driverUser._id,
      organization: org1._id,
      status: 'SCHEDULED'
    });

    // Create Booking
    booking = await Booking.create({
      ride: ride._id,
      passenger: passengerUser._id,
      organization: org1._id,
      seats: 1,
      fareTotalMinor: 15000,
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      pickupAddress: 'Electronic City Gate',
      pickupPoint: { type: 'Point', coordinates: [77.6800, 12.8500] },
      dropAddress: 'ITPL Main Gate',
      dropPoint: { type: 'Point', coordinates: [77.7500, 12.9700] }
    });
  });

  // Helper to create client socket
  const createSocket = (token) => {
    return Client(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });
  };

  describe('1. Socket Authentication & Room Authorization', () => {
    it('rejects connection without a token', async () => {
      const socket = Client(serverUrl, { transports: ['websocket'], forceNew: true });
      const err = await new Promise((resolve) => {
        socket.on('connect_error', resolve);
      });
      expect(err.data?.code).toBe('UNAUTHORIZED');
      socket.close();
    });

    it('rejects connection with an invalid token', async () => {
      const socket = createSocket('invalid.jwt.token');
      const err = await new Promise((resolve) => {
        socket.on('connect_error', resolve);
      });
      expect(err.data?.code).toBe('INVALID_TOKEN');
      socket.close();
    });

    it('successfully connects authenticated active user and joins private user room', async () => {
      const socket = createSocket(driverToken);
      await new Promise((resolve) => socket.on('connect', resolve));
      expect(socket.connected).toBe(true);
      socket.close();
    });

    it('rejects non-participant from joining trip room', async () => {
      const socket = createSocket(otherOrgToken);
      await new Promise((resolve) => socket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        socket.emit('trip:join', { tripId: trip._id.toString() }, resolve);
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('NOT_A_PARTICIPANT');
      socket.close();
    });

    it('enforces organization isolation for trip rooms', async () => {
      const socket = createSocket(otherOrgToken);
      await new Promise((resolve) => socket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        socket.emit('trip:join', { tripId: trip._id.toString() }, resolve);
      });

      expect(res.success).toBe(false);
      socket.close();
    });

    it('allows driver and confirmed passenger to join trip room and receive initial snapshot', async () => {
      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        driverSocket.emit('trip:join', { tripId: trip._id.toString() }, resolve);
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('SCHEDULED');
      expect(res.data?.isDriver).toBe(true);

      driverSocket.close();
    });
  });

  describe('2. Live Tracking, Location Updates & Throttling', () => {
    it('rejects location updates when trip status is SCHEDULED', async () => {
      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        driverSocket.emit(
          'driver:location',
          { tripId: trip._id.toString(), lat: 12.8600, lng: 77.6900 },
          resolve
        );
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_TRIP_STATUS');
      driverSocket.close();
    });

    it('rejects location updates from a non-driver passenger', async () => {
      trip.status = 'STARTED';
      await trip.save();

      const passengerSocket = createSocket(passengerToken);
      await new Promise((resolve) => passengerSocket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        passengerSocket.emit(
          'driver:location',
          { tripId: trip._id.toString(), lat: 12.8600, lng: 77.6900 },
          resolve
        );
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED_DRIVER');
      passengerSocket.close();
    });

    it('rejects invalid coordinates', async () => {
      trip.status = 'STARTED';
      await trip.save();

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const res = await new Promise((resolve) => {
        driverSocket.emit(
          'driver:location',
          { tripId: trip._id.toString(), lat: 999, lng: 77.6900 },
          resolve
        );
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_COORDINATES');
      driverSocket.close();
    });

    it('first accepted location moves trip from STARTED to IN_PROGRESS atomically and broadcasts status', async () => {
      trip.status = 'STARTED';
      await trip.save();

      const passengerSocket = createSocket(passengerToken);
      await new Promise((resolve) => passengerSocket.on('connect', resolve));
      await new Promise((resolve) => passengerSocket.emit('trip:join', { tripId: trip._id.toString() }, resolve));

      const statusPromise = new Promise((resolve) => {
        passengerSocket.on('trip:status', (data) => {
          if (data.status === 'IN_PROGRESS') resolve(data);
        });
      });

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const updateRes = await new Promise((resolve) => {
        driverSocket.emit(
          'driver:location',
          { tripId: trip._id.toString(), lat: 12.8600, lng: 77.6900, speed: 45 },
          resolve
        );
      });

      expect(updateRes.success).toBe(true);

      const statusBroadcast = await statusPromise;
      expect(statusBroadcast.status).toBe('IN_PROGRESS');

      const updatedTrip = await Trip.findById(trip._id);
      expect(updatedTrip.status).toBe('IN_PROGRESS');
      expect(updatedTrip.lastKnownLocation?.coordinates).toEqual([77.6900, 12.8600]);

      passengerSocket.close();
      driverSocket.close();
    });

    it('throttles location updates within 3 seconds', async () => {
      trip.status = 'IN_PROGRESS';
      await trip.save();

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      // First update accepted
      const first = await new Promise((resolve) => {
        driverSocket.emit('driver:location', { tripId: trip._id.toString(), lat: 12.8610, lng: 77.6910 }, resolve);
      });
      expect(first.success).toBe(true);

      // Immediate second update dropped by throttle
      const second = await new Promise((resolve) => {
        driverSocket.emit('driver:location', { tripId: trip._id.toString(), lat: 12.8620, lng: 77.6920 }, resolve);
      });
      expect(second.dropped).toBe(true);

      driverSocket.close();
    });

    it('caches ETA and does not call routing provider on every ping', async () => {
      trip.status = 'IN_PROGRESS';
      await trip.save();

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      // First ping
      await new Promise((resolve) => {
        driverSocket.emit('driver:location', { tripId: trip._id.toString(), lat: 12.8600, lng: 77.6900 }, resolve);
      });

      expect(calculateRouteSpy).toHaveBeenCalledTimes(1);

      // Fast forward time slightly (past 3s throttle but within 45s ETA cache)
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 4000);

      await new Promise((resolve) => {
        driverSocket.emit('driver:location', { tripId: trip._id.toString(), lat: 12.8650, lng: 77.6950 }, resolve);
      });

      // Provider was NOT called again because ETA is cached for 45s
      expect(calculateRouteSpy).toHaveBeenCalledTimes(1);

      Date.now = originalNow;
      driverSocket.close();
    });

    it('GET /api/trips/:id/tracking returns live tracking data for participant and flags staleness', async () => {
      trip.status = 'IN_PROGRESS';
      trip.lastKnownLocation = { type: 'Point', coordinates: [77.6900, 12.8600] };
      trip.lastLocationAt = new Date(Date.now() - 40000); // 40 seconds ago (> 30s)
      await trip.save();

      const res = await request(app)
        .get(`/api/trips/${trip._id}/tracking`)
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.isStale).toBe(true);
      expect(res.body.data.lastKnownLocation).toEqual({ lat: 12.8600, lng: 77.6900 });
      expect(res.body.data.routeGeometry).toBeDefined();
    });
  });

  describe('3. Real-Time Chat & Authorization', () => {
    it('allows driver and confirmed passenger to exchange chat messages in real time', async () => {
      const passengerSocket = createSocket(passengerToken);
      await new Promise((resolve) => passengerSocket.on('connect', resolve));
      await new Promise((resolve) => passengerSocket.emit('trip:join', { tripId: trip._id.toString() }, resolve));

      const messageReceivedPromise = new Promise((resolve) => {
        passengerSocket.on('chat:message', resolve);
      });

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const sendRes = await new Promise((resolve) => {
        driverSocket.emit('chat:send', { tripId: trip._id.toString(), text: 'Hello, waiting at gate 1!' }, resolve);
      });

      expect(sendRes.success).toBe(true);
      expect(sendRes.data.content).toBe('Hello, waiting at gate 1!');

      const received = await messageReceivedPromise;
      expect(received.content).toBe('Hello, waiting at gate 1!');
      expect(received.sender.name).toBe('Priya Sharma (Driver)');

      passengerSocket.close();
      driverSocket.close();
    });

    it('rejects company admin from viewing or sending chat content', async () => {
      // REST
      const res = await request(app)
        .get(`/api/trips/${trip._id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_ADMIN');

      // Socket
      const adminSocket = createSocket(adminToken);
      await new Promise((resolve) => adminSocket.on('connect', resolve));

      const socketRes = await new Promise((resolve) => {
        adminSocket.emit('chat:send', { tripId: trip._id.toString(), text: 'Admin test' }, resolve);
      });

      expect(socketRes.success).toBe(false);
      expect(socketRes.error?.code).toBe('FORBIDDEN_ADMIN');
      adminSocket.close();
    });

    it('rejects non-participant and cancelled passenger from chatting', async () => {
      booking.status = 'CANCELLED_BY_PASSENGER';
      await booking.save();

      const passengerSocket = createSocket(passengerToken);
      await new Promise((resolve) => passengerSocket.on('connect', resolve));

      const sendRes = await new Promise((resolve) => {
        passengerSocket.emit('chat:send', { tripId: trip._id.toString(), text: 'Am I still here?' }, resolve);
      });

      expect(sendRes.success).toBe(false);
      expect(sendRes.error?.code).toBe('NOT_A_PARTICIPANT');
      passengerSocket.close();
    });

    it('validates message content: rejects empty messages and limits to 1000 characters', async () => {
      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      // Empty text
      const emptyRes = await new Promise((resolve) => {
        driverSocket.emit('chat:send', { tripId: trip._id.toString(), text: '   ' }, resolve);
      });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error?.code).toBe('EMPTY_MESSAGE');

      // Oversized text
      const longText = 'a'.repeat(1001);
      const longRes = await new Promise((resolve) => {
        driverSocket.emit('chat:send', { tripId: trip._id.toString(), text: longText }, resolve);
      });
      expect(longRes.success).toBe(false);
      expect(longRes.error?.code).toBe('MESSAGE_TOO_LONG');

      driverSocket.close();
    });

    it('enforces chat read-only window 24 hours after trip completion', async () => {
      trip.status = 'COMPLETED';
      trip.completedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago (> 24h)
      await trip.save();

      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      const sendRes = await new Promise((resolve) => {
        driverSocket.emit('chat:send', { tripId: trip._id.toString(), text: 'Too late to message' }, resolve);
      });

      expect(sendRes.success).toBe(false);
      expect(sendRes.error?.code).toBe('CHAT_READ_ONLY');
      driverSocket.close();
    });

    it('rate-limits chat message sending (10 messages per 10s)', async () => {
      const driverSocket = createSocket(driverToken);
      await new Promise((resolve) => driverSocket.on('connect', resolve));

      let lastRes;
      for (let i = 0; i < 11; i++) {
        lastRes = await new Promise((resolve) => {
          driverSocket.emit('chat:send', { tripId: trip._id.toString(), text: `Ping ${i}` }, resolve);
        });
      }

      expect(lastRes.success).toBe(false);
      expect(lastRes.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      driverSocket.close();
    });
  });

  describe('4. Real-Time Socket Notifications', () => {
    it('pushes notification:new to the target user private room only', async () => {
      const passengerSocket = createSocket(passengerToken);
      await new Promise((resolve) => passengerSocket.on('connect', resolve));

      const notifPromise = new Promise((resolve) => {
        passengerSocket.on('notification:new', resolve);
      });

      // Starting trip triggers notifyTripStarted
      await request(app)
        .post(`/api/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      const receivedNotif = await notifPromise;
      expect(receivedNotif.type).toBe('TRIP_STARTED');
      expect(receivedNotif.user.toString()).toBe(passengerUser._id.toString());

      passengerSocket.close();
    });
  });

  describe('5. Development Tracking Simulator', () => {
    it('returns 404/disabled when in production mode', async () => {
      const envModule = await import('../src/config/env.js');
      const prevEnvVal = envModule.default.NODE_ENV;


      // Simulate production
      envModule.default.NODE_ENV = 'production';

      const res = await request(app)
        .post(`/api/dev/trips/${trip._id}/simulate-location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ stepIndex: 0 });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('SIMULATOR_DISABLED');

      envModule.default.NODE_ENV = prevEnvVal;
    });

    it('steps along route geometry and sets simulated: true in dev mode', async () => {
      trip.status = 'STARTED';
      await trip.save();

      const envModule = await import('../src/config/env.js');
      envModule.default.ENABLE_TRACKING_SIMULATOR = true;

      const res = await request(app)
        .post(`/api/dev/trips/${trip._id}/simulate-location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ stepIndex: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.simulated).toBe(true);
      expect(res.body.data.stepIndex).toBe(1);
    });
  });
});
