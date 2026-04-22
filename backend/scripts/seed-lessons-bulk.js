/**
 * Replaces ALL lessons with 120 entries:
 * - arabicText = display (with harakat) for UI + TTS
 * - arabicTextForComparison = plain letters only (no zabar/zeer/pesh/shadda/sukun/tatweel/ٱ/ٰ)
 *
 * Run from backend: node scripts/seed-lessons-bulk.js
 * WARNING: Clears existing lessons. Users' practicePassedLessonIds may point to deleted IDs.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');

function toPlainArabic(s) {
  if (!s) return '';
  return s
    .replace(/\u0671/g, '\u0627')
    .replace(/[\u064B-\u0652\u0640\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LETTER_LESSONS = [
  ['أَلِفٌ', 'Alif'],
  ['بَاءٌ', 'Ba'],
  ['تَاءٌ', 'Ta'],
  ['ثَاءٌ', 'Tha'],
  ['جِيمٌ', 'Jeem'],
  ['حَاءٌ', 'Ha'],
  ['خَاءٌ', 'Kha'],
  ['دَالٌ', 'Dal'],
  ['ذَالٌ', 'Dhal'],
  ['رَاءٌ', 'Ra'],
  ['زَايٌ', 'Zay'],
  ['سِينٌ', 'Seen'],
  ['شِينٌ', 'Sheen'],
  ['صَادٌ', 'Sad'],
  ['ضَادٌ', 'Dad'],
  ['طَاءٌ', 'Taa'],
  ['ظَاءٌ', 'Zah'],
  ['عَيْنٌ', 'Ain'],
  ['غَيْنٌ', 'Ghain'],
  ['فَاءٌ', 'Fa'],
  ['قَافٌ', 'Qaf'],
  ['كَافٌ', 'Kaf'],
  ['لَامٌ', 'Lam'],
  ['مِيمٌ', 'Meem'],
  ['نُونٌ', 'Noon'],
  ['هَاءٌ', 'Ha'],
  ['وَاوٌ', 'Waw'],
  ['يَاءٌ', 'Ya'],
];

const PHRASE_POOL = [
  'بِسْمِ',
  'ٱللَّهِ',
  'ٱلرَّحْمَٰنِ',
  'ٱلرَّحِيمِ',
  'ٱلْحَمْدُ',
  'لِلَّهِ',
  'رَبِّ',
  'ٱلْعَالَمِينَ',
  'مَٰلِكِ',
  'يَوْمِ',
  'ٱلدِّينِ',
  'إِيَّاكَ',
  'نَعْبُدُ',
  'وَإِيَّاكَ',
  'نَسْتَعِينُ',
  'ٱهْدِنَا',
  'ٱلصِّرَٰطَ',
  'ٱلْمُسْتَقِيمَ',
  'صِرَٰطَ',
  'ٱلَّذِينَ',
  'أَنْعَمْتَ',
  'عَلَيْهِمْ',
  'غَيْرِ',
  'ٱلْمَغْضُوبِ',
  'عَلَيْهِمْ',
  'وَلَا',
  'ٱلضَّآلِّينَ',
  'قُلْ',
  'هُوَ',
  'ٱللَّهُ',
  'أَحَدٌ',
  'ٱلصَّمَدُ',
  'لَمْ',
  'يَلِدْ',
  'وَلَمْ',
  'يُولَدْ',
  'وَلَمْ',
  'يَكُن',
  'لَّهُ',
  'كُفُوًا',
  'أَحَدٌ',
  'كِتَابٌ',
  'نُورٌ',
  'حَقٌّ',
  'عِلْمٌ',
  'إِيمَانٌ',
  'إِسْلَامٌ',
  'قُرْآنٌ',
  'دِينٌ',
  'صَلَاةٌ',
  'صَوْمٌ',
  'حَجٌّ',
  'زَكَاةٌ',
  'طَهَارَةٌ',
  'وُضُوءٌ',
  'سُورَةٌ',
  'آيَةٌ',
  'حَرْفٌ',
  'مَدٌّ',
  'غُنَّةٌ',
  'إِدْغَامٌ',
  'إِظْهَارٌ',
  'إِخْفَاءٌ',
  'إِقْلَابٌ',
  'تَحْقِيقٌ',
  'تَرْقِيقٌ',
  'تَفْخِيمٌ',
  'مَخْرَجٌ',
  'صِفَةٌ',
  'حَرَكَةٌ',
  'سُكُونٌ',
  'شَدَّةٌ',
  'تَنْوِينٌ',
  'فَتْحَةٌ',
  'كَسْرَةٌ',
  'ضَمَّةٌ',
  'هَمْزَةٌ',
  'تَوْحِيدٌ',
  'رَحْمَةٌ',
  'بَرَكَةٌ',
  'سَلَامٌ',
  'حَيَاةٌ',
  'مَوْتٌ',
  'قِيَامَةٌ',
  'جَنَّةٌ',
  'نَارٌ',
  'صِرَاطٌ',
  'مُسْلِمٌ',
  'مُؤْمِنٌ',
  'مُحْسِنٌ',
  'تَقْوَىٰ',
  'صَبْرٌ',
  'شُكْرٌ',
  'ذِكْرٌ',
  'دُعَاءٌ',
  'قُرْءَانٌ',
  'لِسَانٌ',
  'شَفَتَانِ',
  'لِهَاجٌ',
  'حَلْقٌ',
  'لَوْنٌ',
  'صَوْتٌ',
  'نَفْسٌ',
  'رُوحٌ',
  'قَلْبٌ',
  'عَقْلٌ',
  'حِكْمَةٌ',
  'عَدْلٌ',
  'حُرِّيَّةٌ',
  'سَلَامَةٌ',
  'عَافِيَةٌ',
  'شِفَاءٌ',
  'نَجَاحٌ',
  'فَوْزٌ',
  'خَيْرٌ',
  'بَرٌّ',
  'وَالِدَانِ',
  'وَلَدٌ',
  'أُخْتٌ',
  'أَخٌ',
  'بَيْتٌ',
  'بَابٌ',
  'كُرْسِيٌّ',
  'سَمَاءٌ',
  'أَرْضٌ',
  'بَحْرٌ',
  'نَهْرٌ',
  'شَمْسٌ',
  'قَمَرٌ',
  'نَجْمٌ',
  'لَيْلٌ',
  'نَهَارٌ',
  'صَبَاحٌ',
  'مَسَاءٌ',
];

function buildLessons() {
  const out = [];
  let order = 1;

  for (let i = 0; i < LETTER_LESSONS.length; i++) {
    const [ar, name] = LETTER_LESSONS[i];
    out.push({
      title: `Lesson ${order}: ${name} (${toPlainArabic(ar).slice(0, 3) || name})`,
      slug: `hut-l${String(order).padStart(3, '0')}-${name.toLowerCase()}`,
      description: `Learn the letter ${name} — Makhraj and sound.`,
      category: 'Arabic letters',
      level: 'beginner',
      ruleSummary: `Practice the letter name and shape. Listen, then practice pronunciation.`,
      arabicText: ar,
      arabicTextForComparison: toPlainArabic(ar),
      order: order++,
      isActive: true,
    });
  }

  const TARGET = 120;
  let p = 0;
  while (out.length < TARGET) {
    const a = PHRASE_POOL[p % PHRASE_POOL.length];
    const b = PHRASE_POOL[(p + 17) % PHRASE_POOL.length];
    const display = p % 3 === 0 ? a : `${a} ${b}`;
    const plain = toPlainArabic(display);
    if (!plain) {
      p++;
      continue;
    }
    out.push({
      title: `Lesson ${order}: Phrase ${order}`,
      slug: `hut-p${String(order).padStart(3, '0')}`,
      description: `Tajweed vocabulary practice — phrase ${order} of ${TARGET}.`,
      category: order < 60 ? 'Words & phrases' : order < 100 ? 'Verse fragments' : 'Extended practice',
      level: order < 55 ? 'beginner' : order < 95 ? 'intermediate' : 'advanced',
      ruleSummary: `Pronounce clearly. Your speech is compared to plain letters (no harakat).`,
      arabicText: display.trim(),
      arabicTextForComparison: plain,
      order: order++,
      isActive: true,
    });
    p++;
  }

  return out.slice(0, TARGET);
}

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const del = await Lesson.deleteMany({});
  console.log('Removed lessons:', del.deletedCount);
  const docs = buildLessons();
  await Lesson.insertMany(docs);
  console.log('Inserted', docs.length, 'lessons (arabicText + arabicTextForComparison).');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
