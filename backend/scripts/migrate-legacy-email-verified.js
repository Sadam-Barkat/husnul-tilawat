/**
 * One-time: set emailVerified=true for accounts created before verification was added
 * (field missing). Safe to run multiple times.
 *
 *   node scripts/migrate-legacy-email-verified.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection('users');
  const r = await col.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  console.log('Matched:', r.matchedCount, 'Modified:', r.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
