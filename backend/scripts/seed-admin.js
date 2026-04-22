/**
 * Create or reset the default admin account.
 *
 * Run from backend folder:
 *   node scripts/seed-admin.js
 *
 * Email: admin@gmail.com
 * Password: 123
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = '123';
const ADMIN_NAME = 'Administrator';

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash(ADMIN_PASSWORD, await bcrypt.genSalt(10));
  const email = ADMIN_EMAIL.toLowerCase();
  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: ADMIN_NAME,
        email,
        role: 'admin',
        password: hash,
        emailVerified: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
  );
  console.log('Admin ready:', email);
  console.log('Password:', ADMIN_PASSWORD, '(short password — stored as bcrypt hash)');
  console.log('Log in at /admin');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
