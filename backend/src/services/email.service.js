import nodemailer from 'nodemailer';
import { FRONTEND_URL, SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from '../utils/constants.js';

let transportOverride = null;

export const setEmailTransport = (transport) => {
  transportOverride = transport;
};

const transport = () => {
  if (transportOverride) return transportOverride;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
};

export const sendEmail = async ({ to, subject, text }) => {
  await transport().sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
  });
};

const frontendLink = (pathname, token) => {
  const url = new URL(pathname, FRONTEND_URL);
  url.searchParams.set('token', token);
  return url.toString();
};

export const sendActivationEmail = (to, token) =>
  sendEmail({
    to,
    subject: 'Activate your account',
    text: `Confirm your account by opening this link within 30 minutes:\n${frontendLink('/verify', token)}\n`,
  });

export const sendResetEmail = (to, token) =>
  sendEmail({
    to,
    subject: 'Reset your password',
    text: `Reset your password by opening this link within 15 minutes:\n${frontendLink('/reset-password', token)}\n`,
  });

export const sendPasswordChangedEmail = async (to) => {
  try {
    await sendEmail({
      to,
      subject: 'Your password was changed',
      text: 'Your password was changed. If you did not do this, reset your password immediately.\n',
    });
    return true;
  } catch (error) {
    console.error('[email] password confirmation failed');
    void error;
    return false;
  }
};
