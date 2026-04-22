'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const CODE_LENGTH = 6;
const SALT_ROUNDS = 10;

/**
 * Cryptographically secure numeric OTP (leading zeros preserved).
 */
function generateVerificationCode() {
  const max = 10 ** CODE_LENGTH;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(CODE_LENGTH, '0');
}

async function hashVerificationCode(plain) {
  const normalized = String(plain).trim();
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

async function compareVerificationCode(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(String(plain).trim(), hash);
}

module.exports = {
  generateVerificationCode,
  hashVerificationCode,
  compareVerificationCode,
  CODE_LENGTH,
};
