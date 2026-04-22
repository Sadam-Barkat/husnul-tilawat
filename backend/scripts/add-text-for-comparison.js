/**
 * One-time script: set textForComparison on all PracticePhrase documents
 * (same as text but with harakat removed). Run from backend: node scripts/add-text-for-comparison.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PracticePhrase = require('../models/PracticePhrase');

// Plain letters only: no zabar, zair, pesh, shadda, sukun, tatweel, superscript alef.
// Normalize Alef Wasla (ٱ) to plain Alef (ا).
function toPlainArabic(s) {
  if (!s) return '';
  return s
    .replace(/\u0671/g, '\u0627')   // ٱ (alef wasla) → ا (alef)
    .replace(/[\u064B-\u0652\u0640\u0670]/g, '')  // diacritics, tatweel, ٰ (superscript alef)
    .trim();
}

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const phrases = await PracticePhrase.find({});
  let updated = 0;
  for (const doc of phrases) {
    const comparison = toPlainArabic(doc.text);
    if (doc.textForComparison !== comparison) {
      doc.textForComparison = comparison;
      await doc.save();
      updated++;
      console.log('Updated:', doc.label);
    }
  }
  console.log('Done. Updated', updated, 'of', phrases.length, 'phrases.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
