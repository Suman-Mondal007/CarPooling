import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import RefreshSession from '../models/RefreshSession.js';

export const seed = async () => {
  if (env.NODE_ENV === 'production') {
    console.error('❌ SEED REFUSED: Cannot seed database in production environment (NODE_ENV=production).');
    process.exit(1);
  }

  console.log('🌱 Starting database seeding for development...');

  try {
    await connectDB();

    // Clean previous seeded records
    await RefreshSession.deleteMany({});
    await User.deleteMany({ isSeeded: true });
    await Organization.deleteMany({ isSeeded: true });

    // Also clear if default admin email exists
    await User.deleteMany({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });

    // 1. Create Demo Organization
    const autoApprove = Boolean(env.SEED_AUTO_APPROVE);
    const org = await Organization.create({
      name: 'Acme Global Technologies',
      registrationCode: 'ACME2026',
      timezone: 'Asia/Kolkata',
      settings: {
        autoApproveEmployees: autoApprove,
        requireEmployeeId: false,
        fuelPricePerLitre: 105,
        operationalCostPerKm: 3.5,
        cancellationCutoffMinutes: 60,
        requireVehicleVerification: true
      },
      isSeeded: true
    });

    console.log(`✅ Organization created: "${org.name}" (Code: ${org.registrationCode})`);

    // 2. Create Company Admin
    const adminPassword = env.SEED_ADMIN_PASSWORD;
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    const admin = await User.create({
      name: 'Alice Admin',
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      phone: '+919876500000',
      passwordHash: adminPasswordHash,
      role: 'COMPANY_ADMIN',
      organization: org._id,
      employeeId: 'ADM-001',
      status: 'ACTIVE',
      isSeeded: true
    });

    // 3. Create 3 Sample Active Employees
    const employeeDefaultPassword = 'Employee@Pass123';
    const employeePasswordHash = await bcrypt.hash(employeeDefaultPassword, 10);

    const employees = await User.create([
      {
        name: 'Priya Sharma',
        email: 'priya.sharma@enterprise.local',
        phone: '+919876500001',
        passwordHash: employeePasswordHash,
        role: 'EMPLOYEE',
        organization: org._id,
        employeeId: 'EMP-101',
        status: 'ACTIVE',
        licenceNumber: 'KA0120220001234',
        licenceExpiry: new Date('2032-05-15'),
        isSeeded: true
      },
      {
        name: 'Rahul Verma',
        email: 'rahul.verma@enterprise.local',
        phone: '+919876500002',
        passwordHash: employeePasswordHash,
        role: 'EMPLOYEE',
        organization: org._id,
        employeeId: 'EMP-102',
        status: 'ACTIVE',
        licenceNumber: 'KA0320210005678',
        licenceExpiry: new Date('2030-11-20'),
        isSeeded: true
      },
      {
        name: 'Sneha Patel',
        email: 'sneha.patel@enterprise.local',
        phone: '+919876500003',
        passwordHash: employeePasswordHash,
        role: 'EMPLOYEE',
        organization: org._id,
        employeeId: 'EMP-103',
        status: 'ACTIVE',
        isSeeded: true
      }
    ]);

    console.log('\n================================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log(`🏢 Organization        : ${org.name}`);
    console.log(`🔑 Registration Code   : ${org.registrationCode}`);
    console.log(`⚙️ Auto Approve Setting : ${autoApprove ? 'ENABLED' : 'DISABLED'}`);
    console.log('----------------------------------------------------------------');
    console.log('👤 COMPANY ADMINISTRATOR:');
    console.log(`   Email    : ${admin.email}`);
    console.log(`   Password : ${adminPassword}`);
    console.log(`   Role     : ${admin.role}`);
    console.log('----------------------------------------------------------------');
    console.log('👥 SAMPLE EMPLOYEES (Password for all: ' + employeeDefaultPassword + '):');
    employees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.name.padEnd(16)} | Email: ${emp.email.padEnd(30)} | ID: ${emp.employeeId} | Status: ${emp.status}`);
    });
    console.log('================================================================\n');

    await disconnectDB();
    return { org, admin, employees };
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await disconnectDB();
    process.exit(1);
  }
};

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
}

export default seed;
