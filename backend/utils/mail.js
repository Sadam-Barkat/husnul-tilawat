'use strict';

const nodemailer = require('nodemailer');
const { SITE_NAME, verificationEmailHtml, passwordResetEmailHtml } = require('./emailTemplates');

/** Read password from env; strip wrapping quotes from .env files. */
function readSmtpPasswordRaw() {
  let p = process.env.SMTP_PASSWORD;
  if (p == null) return '';
  p = String(p).trim();
  if (p.length >= 2 && ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))) {
    p = p.slice(1, -1).trim();
  }
  return p;
}

/** Gmail App Passwords are 16 letters; Google often shows them as four groups with spaces — SMTP needs them without spaces. */
function normalizeSmtpAuthPassword(hostLower, raw) {
  const p = String(raw || '');
  if (hostLower === 'smtp.gmail.com' || hostLower === 'gmail') {
    return p.replace(/\s+/g, '');
  }
  return p;
}

function isSmtpConfigured() {
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  const port = process.env.SMTP_PORT && String(process.env.SMTP_PORT).trim();
  const email = process.env.SMTP_EMAIL && String(process.env.SMTP_EMAIL).trim();
  const password = readSmtpPasswordRaw();
  return Boolean(host && port && email && password);
}

function createTransport() {
  if (!isSmtpConfigured()) return null;
  const hostRaw = String(process.env.SMTP_HOST).trim();
  const hostLower = hostRaw.toLowerCase();
  const port = Number(String(process.env.SMTP_PORT).trim());
  const user = String(process.env.SMTP_EMAIL).trim();
  const passRaw = readSmtpPasswordRaw();
  const pass = normalizeSmtpAuthPassword(hostLower, passRaw);

  const debug = process.env.SMTP_DEBUG === '1' || process.env.SMTP_DEBUG === 'true';

  // Prefer explicit host/port for Gmail (more reliable than service shorthand with some Node versions).
  if (hostLower === 'smtp.gmail.com' || hostLower === 'gmail') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2' },
      debug,
      logger: debug ? console : false,
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
    debug,
    logger: debug ? console : false,
  });
}

let smtpVerifyDone = false;

async function ensureSmtpVerified(transport) {
  if (smtpVerifyDone || process.env.SMTP_SKIP_VERIFY === '1' || process.env.SMTP_SKIP_VERIFY === 'true') {
    return;
  }
  await transport.verify();
  smtpVerifyDone = true;
}

async function sendVerificationEmail(to, code) {
  const transport = createTransport();
  if (!transport) {
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const from = String(process.env.SMTP_EMAIL).trim();
  try {
    await ensureSmtpVerified(transport);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    throw new Error(
      `SMTP login failed (${msg}). For Gmail use an App Password (16 chars), 2FA on, SMTP_HOST=smtp.gmail.com SMTP_PORT=587, and remove spaces from the app password in .env or let the server strip them.`,
    );
  }
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
  try {
    await ensureSmtpVerified(transport);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    throw new Error(
      `SMTP login failed (${msg}). For Gmail use an App Password, SMTP_HOST=smtp.gmail.com SMTP_PORT=587.`,
    );
  }
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
