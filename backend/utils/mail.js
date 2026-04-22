'use strict';

const nodemailer = require('nodemailer');
const { SITE_NAME, verificationEmailHtml, passwordResetEmailHtml } = require('./emailTemplates');

function isSmtpConfigured() {
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  const port = process.env.SMTP_PORT && String(process.env.SMTP_PORT).trim();
  const email = process.env.SMTP_EMAIL && String(process.env.SMTP_EMAIL).trim();
  const password = process.env.SMTP_PASSWORD && String(process.env.SMTP_PASSWORD).trim();
  return Boolean(host && port && email && password);
}

function createTransport() {
  if (!isSmtpConfigured()) return null;
  const hostRaw = String(process.env.SMTP_HOST).trim();
  const hostLower = hostRaw.toLowerCase();
  const port = Number(String(process.env.SMTP_PORT).trim());
  const user = String(process.env.SMTP_EMAIL).trim();
  const pass = String(process.env.SMTP_PASSWORD).trim();

  // Gmail works more reliably with the built-in service preset (STARTTLS on 587).
  if (hostLower === 'smtp.gmail.com' || hostLower === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  const p = Number.isFinite(port) ? port : 587;
  return nodemailer.createTransport({
    host: hostRaw,
    port: p,
    secure: p === 465,
    auth: { user, pass },
    requireTLS: p === 587,
    tls: { minVersion: 'TLSv1.2' },
  });
}

async function sendVerificationEmail(to, code) {
  const transport = createTransport();
  if (!transport) {
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const from = String(process.env.SMTP_EMAIL).trim();
  await transport.sendMail({
    from: `"${SITE_NAME}" <${from}>`,
    to,
    subject: `${SITE_NAME} — Verify your email`,
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not sign up, ignore this email.`,
    html: verificationEmailHtml(code),
  });
}

async function sendPasswordResetEmail(to, code) {
  const transport = createTransport();
  if (!transport) {
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const from = String(process.env.SMTP_EMAIL).trim();
  await transport.sendMail({
    from: `"${SITE_NAME}" <${from}>`,
    to,
    subject: `${SITE_NAME} — Password reset code`,
    text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request a reset, ignore this email.`,
    html: passwordResetEmailHtml(code),
  });
}

module.exports = {
  isSmtpConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
