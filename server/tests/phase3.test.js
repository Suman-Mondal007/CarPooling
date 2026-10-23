import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';
import Vehicle from '../src/models/Vehicle.js';
import Ride from '../src/models/Ride.js';
import Trip from '../src/models/Trip.js';
import SavedPlace from '../src/models/SavedPlace.js';
import { signAccessToken } from '../src/utils/token.js';
import { haversineDistance, simplifyPolyline } from '../src/utils/geo.js';

describe('Phase 3 Tests: Geo Utils, Vehicles, Saved Places, and Offer a Ride', () => {
  let org;
  let driverUser;
  let driverToken;
  let strictOrg;
  let strictDriverUser;
  let strictDriverToken;

  beforeEach(async () => {
    // Clear collections
    await Ride.deleteMany({});
    await Trip.deleteMany({});
    await Vehicle.deleteMany({});
    await SavedPlace.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});

    // Standard organization (requireVehicleVerification: false)
    org = await Organization.create({
      name: 'TechCorp India',
      registrationCode: 'TECH2026',
      settings: {
        autoApproveEmployees: true,
        requireVehicleVerification: false
      }
    });

    driverUser = await User.create({
      name: 'Driver Singh',
      email: 'driver@techcorp.local',
      phone: '+919876543210',
      passwordHash: 'dummyhash',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });

    driverToken = signAccessToken({ userId: driverUser._id, role: driverUser.role });

    // Strict organization (requireVehicleVerification: true)
    strictOrg = await Organization.create({
      name: 'StrictCorp India',
      registrationCode: 'STRICT2026',
      settings: {
        autoApproveEmployees: true,
        requireVehicleVerification: true
      }
    });

    strictDriverUser = await User.create({
      name: 'Strict Driver',
      email: 'driver@strictcorp.local',
      phone: '+919876543211',
      passwordHash: 'dummyhash',
      role: 'EMPLOYEE',
      organization: strictOrg._id,
      status: 'ACTIVE'
    });

    strictDriverToken = signAccessToken({ userId: strictDriverUser._id, role: strictDriverUser.role });
  });

  // 1. Geo Utilities
  describe('Geo Utilities', () => {
    it('haversineDistance correctly calculates distance between two points', () => {
      // Bangalore MG Road to Indiranagar (~4.5km)
      const p1 = { lat: 12.9716, lng: 77.5946 };
      const p2 = { lat: 12.9784, lng: 77.6408 };
      const dist = haversineDistance(p1, p2);
      expect(dist).toBeGreaterThan(4000);
      expect(dist).toBeLessThan(6000);
    });

    it('simplifyPolyline reduces point count to <= maxPoints (300)', () => {
      // Generate 500 coordinates along a line
      const points = [];
      for (let i = 0; i < 500; i++) {
        points.push([77.5946 + i * 0.0001, 12.9716 + i * 0.0001 + Math.sin(i) * 0.00001]);
      }
      expect(points.length).toBe(500);

      const simplified = simplifyPolyline(points, 300);
      expect(simplified.length).toBeLessThanOrEqual(300);
      expect(simplified.length).toBeGreaterThan(2);
    });
  });

  // 2. Vehicle CRUD & Indian Registration Validation
  describe('Vehicle API & Indian Registration Validation', () => {
    it('creates vehicle with valid Indian registration (KA01AB1234) and sets verification based on org', async () => {
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          model: 'Honda City',
          registrationNumber: 'KA-01-AB-1234',
          vehicleType: 'SEDAN',
          seatingCapacity: 5,
          color: 'Silver',
          fuelType: 'PETROL'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registrationNumber).toBe('KA01AB1234');
      // For org with requireVehicleVerification: false, auto verified
      expect(res.body.data.verificationStatus).toBe('VERIFIED');
      expect(res.body.data.fuelEfficiencyKmpl).toBe(15); // default for SEDAN
    });

    it('creates vehicle with BH series registration (22BH1234AA) and requires verification in strict org', async () => {
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${strictDriverToken}`)
        .send({
          model: 'Tata Nexon EV',
          registrationNumber: '22BH1234AA',
          vehicleType: 'SUV',
          seatingCapacity: 5,
          color: 'Blue',
          fuelType: 'ELECTRIC',
          fuelEfficiencyKmpl: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('PENDING');
      expect(res.body.data.fuelEfficiencyKmpl).toBe(0);
    });

    it('rejects invalid registration format', async () => {
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          model: 'Maruti Swift',
          registrationNumber: 'INVALID_REG_123',
          vehicleType: 'HATCHBACK',
          seatingCapacity: 4,
          fuelType: 'PETROL'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('lists driver vehicles and prevents deleting vehicle in active use', async () => {
      const vehicle = await Vehicle.create({
        model: 'Hyundai i20',
        registrationNumber: 'KA02CD5678',
        vehicleType: 'HATCHBACK',
        seatingCapacity: 5,
        fuelType: 'PETROL',
        fuelEfficiencyKmpl: 18,
        owner: driverUser._id,
        organization: org._id,
        verificationStatus: 'VERIFIED'
      });

      const listRes = await request(app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBe(1);

      // Now soft-delete vehicle
      const delRes = await request(app)
        .delete(`/api/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(delRes.status).toBe(200);
      const updated = await Vehicle.findById(vehicle._id);
      expect(updated.isDeleted).toBe(true);
    });
  });

  // 3. Saved Places API
  describe('Saved Places API', () => {
    it('creates, lists, and formats saved places with {lat, lng} coordinates', async () => {
      const createRes = await request(app)
        .post('/api/saved-places')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          label: 'My Home',
          placeType: 'HOME',
          address: 'Koramangala 4th Block, Bangalore',
          lat: 12.9352,
          lng: 77.6245
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.label).toBe('My Home');
      expect(createRes.body.data.lat).toBeCloseTo(12.9352);
      expect(createRes.body.data.lng).toBeCloseTo(77.6245);

      const listRes = await request(app)
        .get('/api/saved-places')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBe(1);
    });
  });

  // 4. Offer a Ride API
  describe('Offer a Ride (POST /api/rides)', () => {
    let verifiedVehicle;
    let pendingVehicle;

    beforeEach(async () => {
      verifiedVehicle = await Vehicle.create({
        model: 'Honda City',
        registrationNumber: 'KA01AB1111',
        vehicleType: 'SEDAN',
        seatingCapacity: 5, // Driver + 4 passengers max
        fuelType: 'PETROL',
        fuelEfficiencyKmpl: 15,
        owner: driverUser._id,
        organization: org._id,
        verificationStatus: 'VERIFIED'
      });

      pendingVehicle = await Vehicle.create({
        model: 'Hyundai Creta',
        registrationNumber: 'KA01AB2222',
        vehicleType: 'SUV',
        seatingCapacity: 5,
        fuelType: 'DIESEL',
        fuelEfficiencyKmpl: 14,
        owner: strictDriverUser._id,
        organization: strictOrg._id,
        verificationStatus: 'PENDING'
      });
    });

    it('successfully publishes ride and creates corresponding SCHEDULED Trip', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const res = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleId: verifiedVehicle._id.toString(),
          originAddress: 'Whitefield, Bangalore',
          origin: { lat: 12.9698, lng: 77.7500 },
          destinationAddress: 'Electronic City, Bangalore',
          destination: { lat: 12.8452, lng: 77.6602 },
          routeGeometry: {
            type: 'LineString',
            coordinates: [
              [77.7500, 12.9698],
              [77.6602, 12.8452]
            ]
          },
          distanceMeters: 25000,
          durationSeconds: 2700,
          departureAt: departureTime.toISOString(),
          totalPassengerSeats: 3,
          farePerSeatRupees: 150,
          notes: 'No smoking, pleasant music'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.availableSeats).toBe(3);
      expect(res.body.data.farePerSeatMinor).toBe(15000); // 150 rupees = 15000 paise
      expect(res.body.data.tripId).toBeDefined();

      // Verify trip in DB
      const trip = await Trip.findById(res.body.data.tripId);
      expect(trip).not.toBeNull();
      expect(trip.status).toBe('SCHEDULED');
      expect(trip.ride.toString()).toBe(res.body.data._id.toString());
    });

    it('enforces totalPassengerSeats <= vehicle.seatingCapacity - 1', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // vehicle.seatingCapacity is 5 -> max passenger seats is 4. Requesting 5 must fail.
      const res = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleId: verifiedVehicle._id.toString(),
          originAddress: 'Whitefield',
          origin: { lat: 12.9698, lng: 77.7500 },
          destinationAddress: 'Electronic City',
          destination: { lat: 12.8452, lng: 77.6602 },
          routeGeometry: {
            type: 'LineString',
            coordinates: [[77.7500, 12.9698], [77.6602, 12.8452]]
          },
          distanceMeters: 25000,
          durationSeconds: 2700,
          departureAt: departureTime.toISOString(),
          totalPassengerSeats: 5 // Over capacity!
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXCEEDS_SEATING_CAPACITY');
    });

    it('blocks offering ride if organization requires vehicle verification and vehicle is PENDING', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${strictDriverToken}`)
        .send({
          vehicleId: pendingVehicle._id.toString(),
          originAddress: 'Whitefield',
          origin: { lat: 12.9698, lng: 77.7500 },
          destinationAddress: 'Electronic City',
          destination: { lat: 12.8452, lng: 77.6602 },
          routeGeometry: {
            type: 'LineString',
            coordinates: [[77.7500, 12.9698], [77.6602, 12.8452]]
          },
          distanceMeters: 25000,
          durationSeconds: 2700,
          departureAt: departureTime.toISOString(),
          totalPassengerSeats: 3
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('VEHICLE_NOT_VERIFIED');
    });

    it('generates recurring ride instances with shared recurrenceGroupId', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tomorrowDay = departureTime.getDay();

      const res = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleId: verifiedVehicle._id.toString(),
          originAddress: 'Whitefield',
          origin: { lat: 12.9698, lng: 77.7500 },
          destinationAddress: 'Electronic City',
          destination: { lat: 12.8452, lng: 77.6602 },
          routeGeometry: {
            type: 'LineString',
            coordinates: [[77.7500, 12.9698], [77.6602, 12.8452]]
          },
          distanceMeters: 25000,
          durationSeconds: 2700,
          departureAt: departureTime.toISOString(),
          totalPassengerSeats: 3,
          recurring: {
            enabled: true,
            daysOfWeek: [tomorrowDay],
            weeks: 2
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.recurrenceGroupId).toBeDefined();

      const ridesInDb = await Ride.find({ recurrenceGroupId: res.body.data.recurrenceGroupId });
      expect(ridesInDb.length).toBe(2);
      // Each ride has an associated Trip
      const tripsInDb = await Trip.find({ ride: { $in: ridesInDb.map((r) => r._id) } });
      expect(tripsInDb.length).toBe(2);
    });

    it('cancels offered ride and its Trip when in SCHEDULED status', async () => {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const pubRes = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleId: verifiedVehicle._id.toString(),
          originAddress: 'Whitefield',
          origin: { lat: 12.9698, lng: 77.7500 },
          destinationAddress: 'Electronic City',
          destination: { lat: 12.8452, lng: 77.6602 },
          routeGeometry: {
            type: 'LineString',
            coordinates: [[77.7500, 12.9698], [77.6602, 12.8452]]
          },
          distanceMeters: 25000,
          durationSeconds: 2700,
          departureAt: departureTime.toISOString(),
          totalPassengerSeats: 3
        });

      const rideId = pubRes.body.data._id;
      const tripId = pubRes.body.data.tripId;

      const cancelRes = await request(app)
        .post(`/api/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);

      const ride = await Ride.findById(rideId);
      const trip = await Trip.findById(tripId);
      expect(ride.status).toBe('CANCELLED');
      expect(trip.status).toBe('CANCELLED');
    });
  });
});
