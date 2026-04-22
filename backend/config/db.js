/**
 * MongoDB Atlas connection configuration.
 * Database "husnultilawat" is auto-created on first connection/insert.
 * Connection string is read from .env (MONGO_URI).
 */
const dns = require('dns');
const mongoose = require('mongoose');

// Prefer IPv4 first — avoids some Windows / dual-stack DNS hangs before Mongo connects.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const MONGO_URI = process.env.MONGO_URI;

function printDnsHelp() {
  console.error('');
  console.error('If you see queryTxt ETIMEOUT / DNS errors with mongodb+srv://');
  console.error('1) Atlas → Connect → Drivers → copy the connection string that starts with mongodb://');
  console.error('   (not mongodb+srv). It lists hostnames like cluster0.xxxxx.mongodb.net:27017.');
  console.error('2) Or fix DNS: Windows network settings → DNS server → 8.8.8.8 and 1.1.1.1, then retry.');
  console.error('3) Atlas → Network Access → allow your IP or 0.0.0.0/0 for development.');
  console.error('');
}

const connectDB = async () => {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 45000,
      connectTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Check MONGO_URI, Atlas cluster status, and Network Access (IP allowlist).');
    const msg = String(err.message || '');
    if (msg.includes('queryTxt') || msg.includes('ETIMEOUT') || msg.includes('ENOTFOUND') || msg.includes('srv')) {
      printDnsHelp();
    }
    process.exit(1);
  }
};

module.exports = connectDB;
