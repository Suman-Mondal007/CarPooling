import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';
import Vehicle from '../src/models/Vehicle.js';
import Ride from '../src/models/Ride.js';
import Trip from '../src/models/Trip.js';
import Booking from '../src/models/Booking.js';
import SupportRequest from '../src/models/SupportRequest.js';
import { signAccessToken } from '../src/utils/token.js';

describe('Phase 7 Tests: History, Settings, Administration & Reports', () => {
  let org;
  let adminUser;
  let adminToken;
  let driverUser;
  let driverToken;
  let passengerUser;
  let passengerToken;
  let vehicle;
  let ride;
  let trip;

  beforeEach(async () => {
    await SupportRequest.deleteMany({});
    await Booking.deleteMany({});
    await Trip.deleteMany({});
    await Ride.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});

    org = await Organization.create({
      name: 'Acme Corp',
      registrationCode: 'ACME2026',
      settings: {
        fuelPricePerLitre: 100,
        operationalCostPerKm: 2,
        cancellationCutoffMinutes: 60,
        autoApproveEmployees: false,
        requireVehicleVerification: true
      }
    });

    adminUser = await User.create({
      name: 'Admin Alice',
      email: 'admin@acme.com',
      phone: '+919876543210',
      passwordHash: 'hash',
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
      organization: org._id
    });
    adminToken = signAccessToken({ userId: adminUser._id, role: adminUser.role });

    driverUser = await User.create({
      name: 'Driver Dave',
      email: 'driver@acme.com',
      phone: '+919876543211',
      passwordHash: 'hash',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      licenceNumber: 'DL-1420110012345',
      organization: org._id
    });
    driverToken = signAccessToken({ userId: driverUser._id, role: driverUser.role });

    passengerUser = await User.create({
      name: 'Passenger Pam',
      email: 'passenger@acme.com',
      phone: '+919876543212',
      passwordHash: 'hash',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      organization: org._id
    });
    passengerToken = signAccessToken({ userId: passengerUser._id, role: passengerUser.role });

    vehicle = await Vehicle.create({
      owner: driverUser._id,
      organization: org._id,
      model: 'Honda City',
      registrationNumber: 'KA01AB1234',
      vehicleType: 'SEDAN',
      seatingCapacity: 4,
      fuelType: 'PETROL',
      fuelEfficiencyKmpl: 15,
      verificationStatus: 'VERIFIED'
    });

    const departure = new Date(Date.now() - 3600000); // 1 hour ago
    ride = await Ride.create({
      organization: org._id,
      driver: driverUser._id,
      vehicle: vehicle._id,
      vehicleSnapshot: {
        model: 'Honda City',
        registrationNumber: 'KA01AB1234',
        vehicleType: 'SEDAN',
        fuelType: 'PETROL',
        fuelEfficiencyKmpl: 15,
        seatingCapacity: 4
      },
      originAddress: 'Whitefield, Bangalore',
      origin: { type: 'Point', coordinates: [77.7499, 12.9698] },
      destinationAddress: 'Koramangala, Bangalore',
      destination: { type: 'Point', coordinates: [77.6245, 12.9352] },
      routeGeometry: {
        type: 'LineString',
        coordinates: [
          [77.7499, 12.9698],
          [77.6245, 12.9352]
        ]
      },
      distanceMeters: 18000,
      durationSeconds: 2400,
      departureAt: departure,
      totalPassengerSeats: 3,
      availableSeats: 2,
      farePerSeatMinor: 15000,
      status: 'CLOSED'
    });

    trip = await Trip.create({
      organization: org._id,
      ride: ride._id,
      driver: driverUser._id,
      status: 'COMPLETED',
      startedAt: departure,
      completedAt: new Date()
    });

    await Booking.create({
      organization: org._id,
      ride: ride._id,
      passenger: passengerUser._id,
      seats: 1,
      fareTotalMinor: 15000,
      status: 'COMPLETED',
      paymentStatus: 'PAID'
    });
  });

  describe('1. Ride History (GET /api/history)', () => {
    it('should return completed trip in driver history', async () => {
      const res = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.role).toBe('driver');
      expect(item.tripId).toBe(trip._id.toString());
      expect(item.vehicleRegistration).toBe('KA01AB1234');
      expect(item.vehicleModel).toBe('Honda City');
    });

    it('should return completed trip in passenger history', async () => {
      const res = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.role).toBe('passenger');
      expect(item.tripId).toBe(trip._id.toString());
      expect(item.participants[0].name).toBe('Driver Dave');
    });

    it('should filter history by role=driver', async () => {
      const res = await request(app)
        .get('/api/history?role=driver')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].role).toBe('driver');
    });

    it('should filter history by role=passenger', async () => {
      const res = await request(app)
        .get('/api/history?role=passenger')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0); // Dave has no passenger trips
    });

    it('should survive vehicle deletion in history', async () => {
      await Vehicle.findByIdAndDelete(vehicle._id);

      const res = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].vehicleRegistration).toBe('KA01AB1234');
      expect(res.body.data.items[0].vehicleModel).toBe('Honda City');
    });
  });

  describe('2. Support Requests & Reports for Employees', () => {
    it('should submit a support request and view it in my support list', async () => {
      const createRes = await request(app)
        .post('/api/users/support')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          subject: 'App payment query',
          category: 'PAYMENTS',
          message: 'How do wallet recharge receipts work on completed rides?'
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.request._id).toBeDefined();

      const listRes = await request(app)
        .get('/api/users/support/my')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.items).toHaveLength(1);
      expect(listRes.body.data.items[0].subject).toBe('App payment query');
    });

    it('should fetch personal reports for driver and passenger', async () => {
      const res = await request(app)
        .get('/api/users/reports')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.asDriver.completedTrips).toBe(1);
      expect(res.body.data.asDriver.distanceKm).toBe(18);
    });
  });

  describe('3. Admin Employees Management', () => {
    let pendingUser;

    beforeEach(async () => {
      pendingUser = await User.create({
        name: 'Pending Pete',
        email: 'pete@acme.com',
        phone: '+919876543219',
        passwordHash: 'hash',
        role: 'EMPLOYEE',
        status: 'PENDING_APPROVAL',
        organization: org._id
      });
    });

    it('should forbid employee from accessing admin employees', async () => {
      const res = await request(app)
        .get('/api/admin/employees')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to list organization employees', async () => {
      const res = await request(app)
        .get('/api/admin/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow admin to approve a pending employee', async () => {
      const res = await request(app)
        .patch(`/api/admin/employees/${pendingUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE', reason: 'Verified employee ID card' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newStatus).toBe('ACTIVE');

      const updated = await User.findById(pendingUser._id);
      expect(updated.status).toBe('ACTIVE');
    });

    it('should allow admin to suspend an active employee', async () => {
      const res = await request(app)
        .patch(`/api/admin/employees/${driverUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Administrative review' });

      expect(res.status).toBe(200);
      expect(res.body.data.newStatus).toBe('SUSPENDED');
    });
  });

  describe('4. Admin Vehicle Verification', () => {
    let pendingVehicle;

    beforeEach(async () => {
      pendingVehicle = await Vehicle.create({
        owner: passengerUser._id,
        organization: org._id,
        model: 'Hyundai i20',
        registrationNumber: 'KA02CD5678',
        vehicleType: 'HATCHBACK',
        seatingCapacity: 4,
        fuelType: 'PETROL',
        fuelEfficiencyKmpl: 16,
        verificationStatus: 'PENDING'
      });
    });

    it('should allow admin to list organization vehicles', async () => {
      const res = await request(app)
        .get('/api/admin/vehicles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow admin to verify a vehicle', async () => {
      const res = await request(app)
        .post(`/api/admin/vehicles/${pendingVehicle._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'VERIFIED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('VERIFIED');

      const updated = await Vehicle.findById(pendingVehicle._id);
      expect(updated.verificationStatus).toBe('VERIFIED');
    });

    it('should allow admin to reject a vehicle with reason', async () => {
      const res = await request(app)
        .post(`/api/admin/vehicles/${pendingVehicle._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'REJECTED', reason: 'Invalid registration certificate' });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('REJECTED');

      const updated = await Vehicle.findById(pendingVehicle._id);
      expect(updated.verificationStatus).toBe('REJECTED');
      expect(updated.rejectionReason).toBe('Invalid registration certificate');
    });
  });

  describe('5. Admin Settings & Code Regeneration', () => {
    it('should fetch organization settings', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registrationCode).toBe('ACME2026');
      expect(res.body.data.settings.fuelPricePerLitre).toBe(100);
    });

    it('should update organization settings', async () => {
      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fuelPricePerLitre: 105.5,
          operationalCostPerKm: 3.5,
          cancellationCutoffMinutes: 45,
          autoApproveEmployees: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.settings.fuelPricePerLitre).toBe(105.5);
      expect(res.body.data.settings.autoApproveEmployees).toBe(true);
    });

    it('should regenerate the organization registration code', async () => {
      const res = await request(app)
        .post('/api/admin/settings/regenerate-code')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registrationCode).toBeDefined();
      expect(res.body.data.registrationCode).not.toBe('ACME2026');

      const updatedOrg = await Organization.findById(org._id);
      expect(updatedOrg.registrationCode).toBe(res.body.data.registrationCode);
    });
  });

  describe('6. Admin Ride Monitoring & Organization Reports', () => {
    it('should allow admin read-only access to organization rides', async () => {
      const res = await request(app)
        .get('/api/admin/rides')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].driver.name).toBe('Driver Dave');
    });

    it('should fetch organization analytics reports', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.completedTrips).toBe(1);
      expect(res.body.data.summary.totalDistanceKm).toBe(18);
      expect(res.body.data.summary.fuelConsumptionLitres.estimate).toBe(true);
      expect(res.body.data.vehicleWiseCost).toHaveLength(1);
    });

    it('should export organization report as CSV', async () => {
      const res = await request(app)
        .get('/api/admin/reports?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Vehicle Model,Registration,Fuel Type');
      expect(res.text).toContain('Honda City');
    });
  });
});
