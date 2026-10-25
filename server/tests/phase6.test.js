import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';
import Vehicle from '../src/models/Vehicle.js';
import Ride from '../src/models/Ride.js';
import Trip from '../src/models/Trip.js';
import Booking from '../src/models/Booking.js';
import Payment from '../src/models/Payment.js';
import Wallet from '../src/models/Wallet.js';
import WalletTransaction from '../src/models/WalletTransaction.js';
import { signAccessToken } from '../src/utils/token.js';
import env from '../src/config/env.js';
import { checkLedgerConsistency } from '../src/services/wallet.service.js';

describe('Phase 6 Tests: Payments and Wallet', () => {
  let org;
  let otherOrg;
  let driverUser;
  let driverToken;
  let passenger1;
  let passenger1Token;
  let passenger2;
  let passenger2Token;
  let vehicle;
  let ride;
  let trip;
  let booking;

  beforeEach(async () => {
    await WalletTransaction.deleteMany({});
    await Wallet.deleteMany({});
    await Payment.deleteMany({});
    await Booking.deleteMany({});
    await Trip.deleteMany({});
    await Ride.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});

    // Reset env config for simulation tests
    env.ALLOW_SIMULATED_PAYMENTS = true;
    env.RAZORPAY_KEY_ID = '';
    env.RAZORPAY_KEY_SECRET = 'dummy_secret_key_12345';
    env.RAZORPAY_WEBHOOK_SECRET = 'dummy_webhook_secret_67890';

    org = await Organization.create({
      name: 'Tech Corp',
      registrationCode: 'TECH2026'
    });

    otherOrg = await Organization.create({
      name: 'Other Corp',
      registrationCode: 'OTHER2026'
    });

    driverUser = await User.create({
      name: 'Driver Dan',
      email: 'dan@tech.local',
      phone: '+919876543210',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });
    driverToken = signAccessToken({ userId: driverUser._id, role: driverUser.role });

    passenger1 = await User.create({
      name: 'Passenger Penny',
      email: 'penny@tech.local',
      phone: '+919876543211',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: org._id,
      status: 'ACTIVE'
    });
    passenger1Token = signAccessToken({ userId: passenger1._id, role: passenger1.role });

    passenger2 = await User.create({
      name: 'Passenger Pete',
      email: 'pete@other.local',
      phone: '+919876543212',
      passwordHash: 'dummy',
      role: 'EMPLOYEE',
      organization: otherOrg._id,
      status: 'ACTIVE'
    });
    passenger2Token = signAccessToken({ userId: passenger2._id, role: passenger2.role });

    vehicle = await Vehicle.create({
      model: 'Toyota Prius',
      registrationNumber: 'KA01AB9999',
      vehicleType: 'SEDAN',
      seatingCapacity: 5,
      fuelType: 'HYBRID',
      fuelEfficiencyKmpl: 22,
      owner: driverUser._id,
      organization: org._id,
      verificationStatus: 'VERIFIED'
    });

    const departureTime = new Date(Date.now() + 3600000);
    ride = await Ride.create({
      driver: driverUser._id,
      organization: org._id,
      vehicle: vehicle._id,
      origin: { type: 'Point', coordinates: [77.5946, 12.9716] },
      destination: { type: 'Point', coordinates: [77.6408, 12.9141] },
      originAddress: 'MG Road, Bengaluru',
      destinationAddress: 'HSR Layout, Bengaluru',
      routeGeometry: {
        type: 'LineString',
        coordinates: [
          [77.5946, 12.9716],
          [77.6408, 12.9141]
        ]
      },
      distanceMeters: 10000,
      durationSeconds: 1500,
      departureAt: departureTime,
      totalPassengerSeats: 3,
      availableSeats: 2,
      farePerSeatMinor: 25000, // ₹250.00
      status: 'CLOSED'
    });

    trip = await Trip.create({
      ride: ride._id,
      driver: driverUser._id,
      organization: org._id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date()
    });

    booking = await Booking.create({
      ride: ride._id,
      passenger: passenger1._id,
      organization: org._id,
      seats: 1,
      fareTotalMinor: 25000, // ₹250.00
      status: 'COMPLETED',
      paymentStatus: 'UNPAID',
      pickupAddress: 'MG Road, Bengaluru',
      pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
      dropAddress: 'HSR Layout, Bengaluru',
      dropLocation: { type: 'Point', coordinates: [77.6408, 12.9141] }
    });
  });

  describe('Online Payment: Order Creation & Server Authority', () => {
    it('creates online order using server booking.fareTotalMinor and ignores tampered client amount', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-order-key-1')
        .send({
          bookingId: booking._id,
          method: 'CARD',
          amountMinor: 100 // Tampered! Server must ignore
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountMinor).toBe(25000); // Server decided amount
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.orderId).toBeDefined();

      // Check DB payment record
      const payment = await Payment.findOne({ idempotencyKey: 'test-order-key-1' });
      expect(payment).toBeDefined();
      expect(payment.amountMinor).toBe(25000);
      expect(payment.status).toBe('CREATED');
    });

    it('requires Idempotency-Key header', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          bookingId: booking._id,
          method: 'CARD'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('rejects order creation if trip/booking is not completed', async () => {
      await Booking.updateOne({ _id: booking._id }, { $set: { status: 'CONFIRMED' } });

      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-order-incomplete')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_NOT_COMPLETED');
    });

    it('rejects order creation if user is not the booking passenger', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${driverToken}`)
        .set('Idempotency-Key', 'test-order-not-passenger')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_BOOKING_PASSENGER');
    });

    it('rejects order creation if booking belongs to another organization (tenant isolation)', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger2Token}`)
        .set('Idempotency-Key', 'test-order-other-org')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORGANIZATION_MISMATCH');
    });

    it('rejects order creation if booking is already PAID', async () => {
      await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'PAID' } });

      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-order-already-paid')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_PAID');
    });

    it('returns 503 PAYMENTS_NOT_CONFIGURED when gateway keys are missing and simulation is disabled', async () => {
      env.RAZORPAY_KEY_ID = '';
      env.RAZORPAY_KEY_SECRET = '';
      env.ALLOW_SIMULATED_PAYMENTS = false;

      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-order-no-gateway')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENTS_NOT_CONFIGURED');
    });
  });

  describe('Online Payment: Verification & Signatures', () => {
    it('verifies valid HMAC signature, marks PAID, and credits driver wallet', async () => {
      // Create payment
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-verify-order-1')
        .send({ bookingId: booking._id, method: 'CARD' });

      const orderId = orderRes.body.data.orderId;
      const paymentId = 'pay_test_card_123';

      let signature;
      if (orderId.startsWith('order_sim_')) {
        signature = `sig_sim_${orderId}_${paymentId}`;
      } else {
        signature = crypto
          .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');
      }

      const verifyRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe('PAID');

      // Verify booking updated to PAID
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.paymentStatus).toBe('PAID');

      // Verify driver wallet was credited
      const driverWallet = await Wallet.findOne({ user: driverUser._id });
      expect(driverWallet.balanceMinor).toBe(25000);

      // Verify driver transaction entry
      const tx = await WalletTransaction.findOne({ user: driverUser._id, type: 'EARNING' });
      expect(tx).toBeDefined();
      expect(tx.amountMinor).toBe(25000);
      expect(tx.idempotencyKey).toBe(`pay:${booking._id}:earning`);

      // Ledger invariant check
      const consistency = await checkLedgerConsistency(driverUser._id);
      expect(consistency.consistent).toBe(true);
    });

    it('rejects invalid or tampered signature with 400', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-verify-invalid')
        .send({ bookingId: booking._id, method: 'CARD' });

      const orderId = orderRes.body.data.orderId;

      const res = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_bad',
          razorpay_signature: 'invalid_tampered_signature_hex'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('replaying verify is idempotent and does NOT double-credit the driver', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-verify-replay')
        .send({ bookingId: booking._id, method: 'CARD' });

      const orderId = orderRes.body.data.orderId;
      const paymentId = 'pay_test_replay_1';
      const signature = orderId.startsWith('order_sim_')
        ? `sig_sim_${orderId}_${paymentId}`
        : crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      // First call
      await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        });

      // Second call (replay)
      const replayRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.data.isReplay).toBe(true);

      // Driver wallet should still have exactly 25000, not 50000
      const driverWallet = await Wallet.findOne({ user: driverUser._id });
      expect(driverWallet.balanceMinor).toBe(25000);

      const txCount = await WalletTransaction.countDocuments({ user: driverUser._id, type: 'EARNING' });
      expect(txCount).toBe(1);
    });

    it('response never leaks secrets', async () => {
      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-leak-check')
        .send({ bookingId: booking._id });

      const jsonStr = JSON.stringify(orderRes.body);
      expect(jsonStr).not.toContain(env.RAZORPAY_KEY_SECRET);
      expect(jsonStr).not.toContain(env.RAZORPAY_WEBHOOK_SECRET);
    });
  });

  describe('Wallet Payment: Atomic Debit & Ledger', () => {
    it('executes wallet payment: debits passenger, credits driver, logs transactions', async () => {
      // Seed passenger wallet with ₹500
      await Wallet.create({
        user: passenger1._id,
        organization: org._id,
        balanceMinor: 50000,
        currency: 'INR'
      });
      await WalletTransaction.create({
        wallet: (await Wallet.findOne({ user: passenger1._id }))._id,
        user: passenger1._id,
        type: 'RECHARGE',
        amountMinor: 50000,
        balanceAfterMinor: 50000,
        description: 'Initial deposit',
        idempotencyKey: 'seed:passenger:1'
      });

      const res = await request(app)
        .post('/api/payments/wallet-pay')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-wallet-pay-1')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.amountMinor).toBe(25000);

      // Passenger balance should be 50000 - 25000 = 25000
      const passengerWallet = await Wallet.findOne({ user: passenger1._id });
      expect(passengerWallet.balanceMinor).toBe(25000);

      // Driver balance should be 25000
      const driverWallet = await Wallet.findOne({ user: driverUser._id });
      expect(driverWallet.balanceMinor).toBe(25000);

      // Booking status updated
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.paymentStatus).toBe('PAID');

      // Verify ledger consistency for both users
      const pConsistency = await checkLedgerConsistency(passenger1._id);
      expect(pConsistency.consistent).toBe(true);
      const dConsistency = await checkLedgerConsistency(driverUser._id);
      expect(dConsistency.consistent).toBe(true);
    });

    it('rejects wallet pay when passenger has insufficient balance (balance unchanged)', async () => {
      // Seed passenger wallet with ₹100 (less than ₹250 fare)
      await Wallet.create({
        user: passenger1._id,
        organization: org._id,
        balanceMinor: 10000,
        currency: 'INR'
      });
      await WalletTransaction.create({
        wallet: (await Wallet.findOne({ user: passenger1._id }))._id,
        user: passenger1._id,
        type: 'RECHARGE',
        amountMinor: 10000,
        balanceAfterMinor: 10000,
        description: 'Initial deposit',
        idempotencyKey: 'seed:passenger:low'
      });

      const res = await request(app)
        .post('/api/payments/wallet-pay')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', 'test-wallet-pay-insufficient')
        .send({ bookingId: booking._id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSUFFICIENT_WALLET_BALANCE');

      // Balance unchanged
      const wallet = await Wallet.findOne({ user: passenger1._id });
      expect(wallet.balanceMinor).toBe(10000);
    });

    it('idempotent retry with same key returns existing payment without double debit', async () => {
      await Wallet.create({
        user: passenger1._id,
        organization: org._id,
        balanceMinor: 50000,
        currency: 'INR'
      });
      await WalletTransaction.create({
        wallet: (await Wallet.findOne({ user: passenger1._id }))._id,
        user: passenger1._id,
        type: 'RECHARGE',
        amountMinor: 50000,
        balanceAfterMinor: 50000,
        description: 'Seed',
        idempotencyKey: 'seed:passenger:replay'
      });

      const key = 'test-wallet-idempotent-key';

      // First call
      await request(app)
        .post('/api/payments/wallet-pay')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', key)
        .send({ bookingId: booking._id });

      // Second call
      const res2 = await request(app)
        .post('/api/payments/wallet-pay')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .set('Idempotency-Key', key)
        .send({ bookingId: booking._id });

      expect(res2.status).toBe(200);
      expect(res2.body.data.isReplay).toBe(true);

      const wallet = await Wallet.findOne({ user: passenger1._id });
      expect(wallet.balanceMinor).toBe(25000); // Only deducted once
    });

    it('concurrency: multiple simultaneous wallet-pay for SAME booking results in exactly 1 debit and 1 credit', async () => {
      await Wallet.create({
        user: passenger1._id,
        organization: org._id,
        balanceMinor: 100000,
        currency: 'INR'
      });
      await WalletTransaction.create({
        wallet: (await Wallet.findOne({ user: passenger1._id }))._id,
        user: passenger1._id,
        type: 'RECHARGE',
        amountMinor: 100000,
        balanceAfterMinor: 100000,
        description: 'Seed',
        idempotencyKey: 'seed:passenger:concurrency'
      });

      // 5 concurrent requests with the SAME idempotency key
      const key = 'concurrent-wallet-key-same';
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/payments/wallet-pay')
          .set('Authorization', `Bearer ${passenger1Token}`)
          .set('Idempotency-Key', key)
          .send({ bookingId: booking._id })
      );

      const results = await Promise.all(requests);
      for (const res of results) {
        expect(res.status).toBe(200);
      }

      // Exactly 1 debit
      const pWallet = await Wallet.findOne({ user: passenger1._id });
      expect(pWallet.balanceMinor).toBe(75000); // 100000 - 25000

      // Exactly 1 credit
      const dWallet = await Wallet.findOne({ user: driverUser._id });
      expect(dWallet.balanceMinor).toBe(25000);
    });

    it('concurrency: simultaneous wallet payments for different bookings never push balance below zero', async () => {
      // Passenger has ₹300 (30000 paise)
      // Two bookings at ₹250 (25000 paise) each. Only one can succeed!
      await Wallet.create({
        user: passenger1._id,
        organization: org._id,
        balanceMinor: 30000,
        currency: 'INR'
      });
      await WalletTransaction.create({
        wallet: (await Wallet.findOne({ user: passenger1._id }))._id,
        user: passenger1._id,
        type: 'RECHARGE',
        amountMinor: 30000,
        balanceAfterMinor: 30000,
        description: 'Seed',
        idempotencyKey: 'seed:passenger:balance-guard'
      });

      const booking2 = await Booking.create({
        ride: ride._id,
        passenger: passenger1._id,
        organization: org._id,
        seats: 1,
        fareTotalMinor: 25000,
        status: 'COMPLETED',
        paymentStatus: 'UNPAID',
        pickupAddress: 'MG Road',
        pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
        dropAddress: 'HSR Layout',
        dropLocation: { type: 'Point', coordinates: [77.6408, 12.9141] }
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/payments/wallet-pay')
          .set('Authorization', `Bearer ${passenger1Token}`)
          .set('Idempotency-Key', 'concurrent-booking-1')
          .send({ bookingId: booking._id }),
        request(app)
          .post('/api/payments/wallet-pay')
          .set('Authorization', `Bearer ${passenger1Token}`)
          .set('Idempotency-Key', 'concurrent-booking-2')
          .send({ bookingId: booking2._id })
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      const pWallet = await Wallet.findOne({ user: passenger1._id });
      expect(pWallet.balanceMinor).toBe(5000); // 30000 - 25000 = 5000 (never negative!)
      expect(pWallet.balanceMinor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cash Flow: Driver Confirmation & Zero Wallet Movement', () => {
    it('passenger selects cash, driver confirms physical receipt, zero wallet movement occurs', async () => {
      // 1. Passenger selects cash
      const cashRes = await request(app)
        .post('/api/payments/cash')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ bookingId: booking._id });

      expect(cashRes.status).toBe(200);
      expect(cashRes.body.data.status).toBe('PENDING_CASH_CONFIRMATION');
      const paymentId = cashRes.body.data.paymentId;

      // 2. Passenger attempts to confirm cash payment -> REJECTED (driver only)
      const passConfirmRes = await request(app)
        .post(`/api/payments/${paymentId}/cash-confirmation`)
        .set('Authorization', `Bearer ${passenger1Token}`);

      expect(passConfirmRes.status).toBe(403);
      expect(passConfirmRes.body.error.code).toBe('UNAUTHORIZED_DRIVER');

      // 3. Driver confirms physical cash
      const driverConfirmRes = await request(app)
        .post(`/api/payments/${paymentId}/cash-confirmation`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(driverConfirmRes.status).toBe(200);
      expect(driverConfirmRes.body.data.status).toBe('PAID');

      // Verify booking updated to PAID
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.paymentStatus).toBe('PAID');

      // CASH MAKES NO WALLET MOVEMENT
      const driverWallet = await Wallet.findOne({ user: driverUser._id });
      const passengerWallet = await Wallet.findOne({ user: passenger1._id });
      expect(driverWallet?.balanceMinor || 0).toBe(0);
      expect(passengerWallet?.balanceMinor || 0).toBe(0);

      const cashTxs = await WalletTransaction.find({});
      expect(cashTxs.length).toBe(0);

      // 4. Idempotent double confirm
      const doubleRes = await request(app)
        .post(`/api/payments/${paymentId}/cash-confirmation`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(doubleRes.status).toBe(200);
      expect(doubleRes.body.data.isReplay).toBe(true);
    });

    it('passenger can cancel pending cash confirmation to switch methods', async () => {
      const cashRes = await request(app)
        .post('/api/payments/cash')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ bookingId: booking._id });

      const paymentId = cashRes.body.data.paymentId;

      const cancelRes = await request(app)
        .post(`/api/payments/${paymentId}/cancel-cash`)
        .set('Authorization', `Bearer ${passenger1Token}`);

      expect(cancelRes.status).toBe(200);

      const deletedPayment = await Payment.findById(paymentId);
      expect(deletedPayment).toBeNull();

      const resetBooking = await Booking.findById(booking._id);
      expect(resetBooking.paymentStatus).toBe('UNPAID');
    });
  });

  describe('Wallet Recharge & Limits', () => {
    it('enforces min ₹10 (1000 paise) and max ₹10,000 (1000000 paise)', async () => {
      // Too low (₹5 = 500 paise)
      const lowRes = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ amountMinor: 500 });

      expect(lowRes.status).toBe(400);
      expect(lowRes.body.error.code).toBe('INVALID_RECHARGE_AMOUNT');

      // Too high (₹15,000 = 1500000 paise)
      const highRes = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ amountMinor: 1500000 });

      expect(highRes.status).toBe(400);
      expect(highRes.body.error.code).toBe('INVALID_RECHARGE_AMOUNT');

      // Valid (₹500 = 50000 paise)
      const validRes = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ amountMinor: 50000 });

      expect(validRes.status).toBe(201);
      expect(validRes.body.data.orderId).toBeDefined();
    });

    it('verifies recharge signature and credits wallet idempotently', async () => {
      const orderId = 'order_sim_rech_12345';
      const paymentId = 'pay_test_rech_12345';
      const signature = `sig_sim_${orderId}_${paymentId}`;

      const res = await request(app)
        .post('/api/wallet/recharge/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amountMinor: 50000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.balanceMinor).toBe(50000);

      // Replay verification does not double credit
      const replayRes = await request(app)
        .post('/api/wallet/recharge/verify')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amountMinor: 50000
        });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.data.balanceMinor).toBe(50000);
      expect(replayRes.body.data.isDuplicate).toBe(true);

      const wallet = await Wallet.findOne({ user: passenger1._id });
      expect(wallet.balanceMinor).toBe(50000);
    });

    it('simulated recharge adds balance in non-production mode', async () => {
      const res = await request(app)
        .post('/api/wallet/simulate-recharge')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ amountMinor: 20000 });

      expect(res.status).toBe(200);
      expect(res.body.data.balanceMinor).toBe(20000);

      const wallet = await Wallet.findOne({ user: passenger1._id });
      expect(wallet.balanceMinor).toBe(20000);
    });
  });

  describe('Webhook & History & User Preferences', () => {
    it('verifies webhook HMAC signature and idempotently marks order paid', async () => {
      // Create payment
      const payment = await Payment.create({
        booking: booking._id,
        trip: trip._id,
        passenger: passenger1._id,
        payer: passenger1._id,
        driver: driverUser._id,
        organization: org._id,
        amountMinor: 25000,
        currency: 'INR',
        method: 'CARD',
        status: 'CREATED',
        razorpayOrderId: 'order_webhook_test_1',
        idempotencyKey: 'webhook-key-1'
      });

      const payload = {
        event: 'order.paid',
        payload: {
          order: { entity: { id: 'order_webhook_test_1' } },
          payment: { entity: { id: 'pay_wh_12345' } }
        }
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(200);

      // Payment marked PAID
      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment.status).toBe('PAID');

      // Driver credited
      const dWallet = await Wallet.findOne({ user: driverUser._id });
      expect(dWallet.balanceMinor).toBe(25000);
    });

    it('returns 400 on invalid webhook signature', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'bad_signature_hex')
        .send({ event: 'order.paid' });

      expect(res.status).toBe(400);
    });

    it('returns payment receipt for authorized participant and rejects unauthorized third party', async () => {
      const payment = await Payment.create({
        booking: booking._id,
        trip: trip._id,
        passenger: passenger1._id,
        payer: passenger1._id,
        driver: driverUser._id,
        organization: org._id,
        amountMinor: 25000,
        currency: 'INR',
        method: 'CARD',
        status: 'PAID',
        paidAt: new Date(),
        idempotencyKey: 'receipt-test-key'
      });

      // Passenger can view
      const pRes = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', `Bearer ${passenger1Token}`);
      expect(pRes.status).toBe(200);
      expect(pRes.body.data._id).toBe(payment._id.toString());

      // Driver can view
      const dRes = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(dRes.status).toBe(200);

      // Other user rejected (403)
      const otherRes = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', `Bearer ${passenger2Token}`);
      expect(otherRes.status).toBe(403);
    });

    it('updates user preferred payment method', async () => {
      const res = await request(app)
        .patch('/api/users/me/payment-preference')
        .set('Authorization', `Bearer ${passenger1Token}`)
        .send({ preferredPaymentMethod: 'WALLET' });

      expect(res.status).toBe(200);
      expect(res.body.data.preferredPaymentMethod).toBe('WALLET');

      const user = await User.findById(passenger1._id);
      expect(user.preferredPaymentMethod).toBe('WALLET');
    });
  });
});
