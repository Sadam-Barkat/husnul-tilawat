/**
 * Set arabicTextForComparison from arabicText for all lessons missing plain text.
 * Run from backend: node scripts/backfill-lesson-plain-arabic.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const { toPlainArabic } = require('../utils/plainArabic');

async function main() {
  const uri = process.env.MONGO_URI_DIRECT || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGO_URI in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const lessons = await Lesson.find({ arabicText: { $exists: true, $ne: '' } });
  let updated = 0;
  for (const lesson of lessons) {
    const plain = toPlainArabic(lesson.arabicText);
    if (!plain) continue;
    if (lesson.arabicTextForComparison !== plain) {
      lesson.arabicTextForComparison = plain;
      await lesson.save();
      updated += 1;
    }
  }
  console.log(`Checked ${lessons.length} lessons, updated ${updated}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
