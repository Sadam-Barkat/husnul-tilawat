/**
 * Practice phrase routes: provide short Qur'anic phrases for recitation practice.
 * text = with harakat (display), textForComparison = without harakat (comparison).
 */
const express = require('express');
const router = express.Router();
const PracticePhrase = require('../models/PracticePhrase');

// Plain letters only: no zabar, zair, pesh, shadda, sukun, tatweel, superscript alef. ٱ → ا.
function toPlainArabic(s) {
  return (s || '')
    .replace(/\u0671/g, '\u0627')
    .replace(/[\u064B-\u0652\u0640\u0670]/g, '')
    .trim();
}

// Seed a default set of phrases if collection is empty
async function ensureSeeded() {
  const count = await PracticePhrase.countDocuments();
  if (count > 0) return;

  const raw = [
    { label: 'Basmalah', text: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', category: 'Surah Al-Fatiha', level: 'beginner', order: 1 },
    { label: 'Al-Fatiha: Ayah 1', text: 'ٱلْحَمْدُ لِلَّٰهِ رَبِّ ٱلْعَالَمِينَ', category: 'Surah Al-Fatiha', level: 'beginner', order: 2 },
    { label: 'Al-Fatiha: Ayah 2', text: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', category: 'Surah Al-Fatiha', level: 'beginner', order: 3 },
    { label: 'Al-Fatiha: Ayah 3', text: 'مَٰلِكِ يَوْمِ ٱلدِّينِ', category: 'Surah Al-Fatiha', level: 'beginner', order: 4 },
  ];
  const phrases = raw.map((p) => ({
    ...p,
    textForComparison: toPlainArabic(p.text),
  }));

  await PracticePhrase.insertMany(phrases);
}

/**
 * GET /api/practice-phrases
 * Get active phrases for recitation practice, auto-seeding defaults if empty.
 */
router.get('/', async (req, res) => {
  try {
    await ensureSeeded();
    const phrases = await PracticePhrase.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(phrases);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch practice phrases' });
  }
});

module.exports = router;

