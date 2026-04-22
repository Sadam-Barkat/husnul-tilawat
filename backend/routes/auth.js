/**
 * Auth: register (with email verification), login, verify, resend, forgot/reset password.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const {
  generateVerificationCode,
  hashVerificationCode,
  compareVerificationCode,
} = require('../utils/verificationCode');
const { sendVerificationEmail, sendPasswordResetEmail, isSmtpConfigured } = require('../utils/mail');

const JWT_EXPIRES = '30d';
const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const USER_SELECT_AUTH =
  '+password +verificationCodeHash +verificationCodeExpires +verificationLastSentAt +passwordResetCodeHash +passwordResetExpires +passwordResetLastSentAt';

function signUserToken(user) {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function userPayload(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

/**
 * POST /api/auth/register
 * Creates unverified user and sends code. No JWT until verified.
 */
router.post('/register', async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        message: 'Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_EMAIL, and SMTP_PASSWORD on the server.',
      });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: emailNorm });

    if (existing) {
      const pending = existing.emailVerified === false;
      if (!pending) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
    }

    const plainCode = generateVerificationCode();
    const codeHash = await hashVerificationCode(plainCode);
    const expires = new Date(Date.now() + VERIFICATION_TTL_MS);
    const now = new Date();

    let user;
    if (existing) {
      existing.name = String(name).trim();
      existing.password = password;
      existing.verificationCodeHash = codeHash;
      existing.verificationCodeExpires = expires;
      existing.verificationLastSentAt = now;
      await existing.save();
      user = existing;
    } else {
      user = await User.create({
        name: String(name).trim(),
        email: emailNorm,
        password,
        emailVerified: false,
        verificationCodeHash: codeHash,
        verificationCodeExpires: expires,
        verificationLastSentAt: now,
      });
    }

    try {
      await sendVerificationEmail(user.email, plainCode);
    } catch (sendErr) {
      console.error('Verification email failed:', sendErr.message, sendErr.response || '');
      if (!existing) {
        await User.findByIdAndDelete(user._id).catch(() => {});
      }
      const hint =
        'Use a Gmail App Password (16 characters, no spaces), 2FA on, and SMTP_HOST=smtp.gmail.com SMTP_PORT=587.';
      return res.status(503).json({
        message: `Could not send verification email: ${sendErr.message || 'SMTP error'}. ${hint}`,
      });
    }

    return res.status(201).json({
      message: 'Check your email for a verification code.',
      needsVerification: true,
      email: user.email,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/verify-email
 * Body: { email, code }
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm }).select(
      '+verificationCodeHash +verificationCodeExpires',
    );
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or code' });
    }
    if (user.emailVerified === true) {
      return res.status(400).json({ message: 'This account is already verified. Please log in.' });
    }
    if (!user.verificationCodeHash || !user.verificationCodeExpires) {
      return res.status(400).json({ message: 'No active verification code. Request a new one.' });
    }
    if (user.verificationCodeExpires.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Verification code has expired. Use resend to get a new code.' });
    }
    const ok = await compareVerificationCode(code, user.verificationCodeHash);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    user.emailVerified = true;
    user.verificationCodeHash = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = signUserToken(user);
    return res.json({
      message: 'Email verified. Welcome!',
      token,
      user: userPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Body: { email }
 */
router.post('/resend-verification', async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({ message: 'Email service is not configured.' });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm }).select(
      '+verificationLastSentAt +verificationCodeHash +verificationCodeExpires',
    );
    if (!user || user.emailVerified === true) {
      return res.json({ message: 'If an unverified account exists for this email, a new code has been sent.' });
    }
    if (user.verificationLastSentAt && Date.now() - user.verificationLastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - user.verificationLastSentAt.getTime())) / 1000,
      );
      return res.status(429).json({ message: `Please wait ${waitSec}s before requesting another code.` });
    }

    const plainCode = generateVerificationCode();
    user.verificationCodeHash = await hashVerificationCode(plainCode);
    user.verificationCodeExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
    user.verificationLastSentAt = new Date();
    await user.save();

    try {
      await sendVerificationEmail(user.email, plainCode);
    } catch (sendErr) {
      console.error('Resend verification email failed:', sendErr.message);
      return res.status(502).json({ message: 'Could not send email. Try again later.' });
    }

    return res.json({ message: 'A new verification code has been sent.' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Could not resend code' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(USER_SELECT_AUTH);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        message: 'Please verify your email before logging in. Check your inbox or request a new code.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }
    const token = signUserToken(user);
    return res.json({
      message: 'Login successful',
      token,
      user: userPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
router.post('/forgot-password', async (req, res) => {
  const generic =
    'If an account exists for that email, we sent a password reset code. It expires in 15 minutes.';
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({ message: 'Email service is not configured.' });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm }).select(
      '+passwordResetLastSentAt +emailVerified',
    );
    if (!user || user.emailVerified === false) {
      return res.json({ message: generic });
    }
    if (
      user.passwordResetLastSentAt &&
      Date.now() - user.passwordResetLastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return res.json({ message: generic });
    }

    const plainCode = generateVerificationCode();
    user.passwordResetCodeHash = await hashVerificationCode(plainCode);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    user.passwordResetLastSentAt = new Date();
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, plainCode);
    } catch (sendErr) {
      console.error('Password reset email failed:', sendErr.message);
      user.passwordResetCodeHash = undefined;
      user.passwordResetExpires = undefined;
      await user.save().catch(() => {});
      return res.status(502).json({ message: 'Could not send reset email. Try again later.' });
    }

    return res.json({ message: generic });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { email, code, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code, and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm }).select(
      '+passwordResetCodeHash +passwordResetExpires +emailVerified',
    );
    if (!user || !user.passwordResetCodeHash || !user.passwordResetExpires) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }
    if (user.passwordResetExpires.getTime() < Date.now()) {
      user.passwordResetCodeHash = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'Reset code has expired. Request a new one.' });
    }
    const ok = await compareVerificationCode(code, user.passwordResetCodeHash);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    user.password = newPassword;
    user.passwordResetCodeHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: 'Password updated. You can log in with your new password.' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Password reset failed' });
  }
});

module.exports = router;
