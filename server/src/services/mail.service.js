import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

if (env.SMTP_HOST && env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

export const sendPasswordResetEmail = async ({ to, resetToken, userName }) => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(to)}`;

  if (!transporter) {
    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] (SMTP not configured)`);
    console.log(`Recipient : ${to} (${userName || 'User'})`);
    console.log(`Reset URL : ${resetUrl}`);
    console.log(`Expires   : in 1 hour`);
    console.log('==================================================\n');
    return { delivered: false, simulated: true, resetUrl };
  }

  const mailOptions = {
    from: env.SMTP_FROM,
    to,
    subject: 'Password Reset Request — Enterprise Carpooling Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
        <h2 style="color: #0d9488;">Enterprise Carpooling Platform</h2>
        <p>Hello ${userName || 'User'},</p>
        <p>You requested a password reset. Click the button below to set a new password. This link is valid for 1 hour.</p>
        <p style="margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="font-size: 13px; color: #64748b;">If you did not request this, please ignore this email or contact your organization administrator.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">If the button does not work, copy and paste this link into your browser: <br/>${resetUrl}</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  return { delivered: true, simulated: false };
};

export default { sendPasswordResetEmail };
