import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import Organization from '../src/models/Organization.js';
import User from '../src/models/User.js';
import { hashToken } from '../src/utils/token.js';

describe('Authentication & Authorization Suite', () => {
  let testOrg;

  beforeEach(async () => {
    // Create standard test organization (autoApprove: false)
    testOrg = await Organization.create({
      name: 'Standard Org',
      registrationCode: 'STD2026',
      settings: {
        autoApproveEmployees: false,
        requireEmployeeId: false
      }
    });

    // Create auto-approve organization
    await Organization.create({
      name: 'Fast Org',
      registrationCode: 'FAST2026',
      settings: {
        autoApproveEmployees: true,
        requireEmployeeId: false
      }
    });
  });

  describe('1. Registration', () => {
    it('should register a new user as PENDING_APPROVAL when autoApprove is false', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john.doe@enterprise.local',
          phone: '+919876543210',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          registrationCode: 'STD2026',
          agreeToTerms: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
      expect(res.body.data.user.email).toBe('john.doe@enterprise.local');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should register a new user as ACTIVE when autoApprove is true', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Active',
          email: 'jane.active@enterprise.local',
          phone: '+919876543211',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          registrationCode: 'FAST2026',
          agreeToTerms: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should reject registration with invalid registration code', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Org User',
          email: 'invalid@enterprise.local',
          phone: '+919876543212',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          registrationCode: 'NONEXISTENT',
          agreeToTerms: true
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_REGISTRATION_CODE');
    });
  });

  describe('2. Login & Credential Verification', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('Secret@123', 10);
      await User.create({
        name: 'Active User',
        email: 'active@enterprise.local',
        phone: '+919876543220',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'ACTIVE'
      });

      await User.create({
        name: 'Pending User',
        email: 'pending@enterprise.local',
        phone: '+919876543221',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'PENDING_APPROVAL'
      });
    });

    it('should login active user successfully and return access token + httpOnly refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'active@enterprise.local',
          password: 'Secret@123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('active@enterprise.local');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Check HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('should fail login with wrong password without leaking email status', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'active@enterprise.local',
          password: 'WrongPassword@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail login for non-existent email with generic error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@enterprise.local',
          password: 'Password@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for PENDING_APPROVAL user with clear status message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'pending@enterprise.local',
          password: 'Secret@123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
    });
  });

  describe('3. Refresh Token Rotation & Reuse Detection', () => {
    let initialCookie;
    let initialAccessToken;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('Secret@123', 10);
      await User.create({
        name: 'Rotation Tester',
        email: 'rotation@enterprise.local',
        phone: '+919876543230',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'ACTIVE'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rotation@enterprise.local', password: 'Secret@123' });

      initialAccessToken = loginRes.body.data.accessToken;
      initialCookie = loginRes.headers['set-cookie'];
    });

    it('should rotate refresh token and issue new access token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.accessToken).not.toBe(initialAccessToken);

      const newCookies = res.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      expect(newCookies).not.toEqual(initialCookie);
    });

    it('should detect reuse of an old refresh token and invalidate the whole family', async () => {
      // 1. Legitimate refresh
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(firstRefresh.status).toBe(200);

      // 2. Attacker/replayed reuse of old initialCookie
      const replayAttempt = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(replayAttempt.status).toBe(401);
      expect(replayAttempt.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // 3. Even the new token from firstRefresh must now be revoked
      const latestCookie = firstRefresh.headers['set-cookie'];
      const subsequentAttempt = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', latestCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(subsequentAttempt.status).toBe(401);
    });
  });

  describe('4. Logout & Invalidation', () => {
    it('should revoke refresh session and clear cookie on logout', async () => {
      const passwordHash = await bcrypt.hash('Secret@123', 10);
      await User.create({
        name: 'Logout User',
        email: 'logout@enterprise.local',
        phone: '+919876543240',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'ACTIVE'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logout@enterprise.local', password: 'Secret@123' });

      const cookie = loginRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify attempting refresh fails after logout
      const refreshAttempt = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(refreshAttempt.status).toBe(401);
    });
  });

  describe('5. Protected Routes & Authorization', () => {
    let employeeToken;
    let adminToken;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('Secret@123', 10);

      await User.create({
        name: 'Emp Worker',
        email: 'emp.worker@enterprise.local',
        phone: '+919876543250',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'ACTIVE'
      });

      await User.create({
        name: 'Admin Boss',
        email: 'admin.boss@enterprise.local',
        phone: '+919876543251',
        passwordHash,
        role: 'COMPANY_ADMIN',
        organization: testOrg._id,
        status: 'ACTIVE'
      });

      const empLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'emp.worker@enterprise.local', password: 'Secret@123' });
      employeeToken = empLogin.body.data.accessToken;

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin.boss@enterprise.local', password: 'Secret@123' });
      adminToken = adminLogin.body.data.accessToken;
    });

    it('should enforce role-based access: employee rejected from /api/admin/settings and admin accepted', async () => {
      const empRes = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(empRes.status).toBe(403);
      expect(empRes.body.error.code).toBe('FORBIDDEN');

      const adminRes = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.settings).toBeDefined();
    });

    it('should reject access to protected /api/auth/me without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow access to /api/auth/me with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('emp.worker@enterprise.local');
    });

    it('should isolate organization data on /api/organizations/me', async () => {
      const res = await request(app)
        .get('/api/organizations/me')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.organization.name).toBe('Standard Org');
      expect(res.body.data.organization.registrationCode).toBe('STD2026');
    });

    it('should allow profile updates on PATCH /api/users/me', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'Emp Worker Updated',
          phone: '+919876543999',
          licenceNumber: 'KA0120229999999'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Emp Worker Updated');
      expect(res.body.data.user.licenceNumber).toBe('KA0120229999999');
    });
  });

  describe('6. Password Reset Flow (Single-use & Expiry)', () => {
    let resetUser;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('OldPassword@123', 10);
      resetUser = await User.create({
        name: 'Reset Target',
        email: 'reset.target@enterprise.local',
        phone: '+919876543260',
        passwordHash,
        role: 'EMPLOYEE',
        organization: testOrg._id,
        status: 'ACTIVE'
      });
    });

    it('should request reset token without revealing email existence', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset.target@enterprise.local' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: 'reset.target@enterprise.local' }).select('+passwordResetTokenHash +passwordResetExpiresAt');
      expect(user.passwordResetTokenHash).toBeDefined();
      expect(user.passwordResetExpiresAt).toBeDefined();
    });

    it('should reset password with valid token and invalidate token for subsequent use', async () => {
      // Setup reset token directly
      const rawToken = 'test-valid-reset-token-1234567890';
      resetUser.passwordResetTokenHash = hashToken(rawToken);
      resetUser.passwordResetExpiresAt = new Date(Date.now() + 3600000);
      await resetUser.save();

      // Reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewPassword@123',
          confirmPassword: 'NewPassword@123'
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify login with new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'reset.target@enterprise.local',
          password: 'NewPassword@123'
        });

      expect(loginRes.status).toBe(200);

      // Verify token cannot be reused
      const secondAttempt = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'AnotherPassword@123',
          confirmPassword: 'AnotherPassword@123'
        });

      expect(secondAttempt.status).toBe(400);
      expect(secondAttempt.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('should reject expired reset token', async () => {
      const rawToken = 'expired-token-12345';
      resetUser.passwordResetTokenHash = hashToken(rawToken);
      resetUser.passwordResetExpiresAt = new Date(Date.now() - 10000); // 10 seconds ago
      await resetUser.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewPassword@123',
          confirmPassword: 'NewPassword@123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });
});
