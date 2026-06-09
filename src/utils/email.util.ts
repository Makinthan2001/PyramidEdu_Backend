import nodemailer from 'nodemailer';
import { AppError } from './AppError';

// Ensure the required environment variables are set
const { SMTP_USER, SMTP_PASS, SENDER_EMAIL } = process.env;

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Fix for self-signed certificate errors
  },
});

export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  if (!SMTP_USER || !SMTP_PASS || !SENDER_EMAIL) {
    console.warn('Missing SMTP credentials. Email not sent.');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"PyramidEdu" <${SENDER_EMAIL}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new AppError('Failed to send email. Please try again later.', 500);
  }
};
