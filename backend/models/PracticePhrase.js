/**
 * PracticePhrase model: short Qur'anic phrases for recitation practice.
 */
const mongoose = require('mongoose');
const { toPlainArabic } = require('../utils/plainArabic');

const practicePhraseSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
    },
    text: {
      // Fully diacritized Arabic phrase (for UI display)
      type: String,
      required: [true, 'Phrase text is required'],
      trim: true,
    },
    textForComparison: {
      // Same verse without harakat (for comparison with STT only)
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

practicePhraseSchema.pre('save', function syncPlainText(next) {
  const withHarakat = this.text && String(this.text).trim();
  if (!withHarakat) return next();
  const plain = toPlainArabic(withHarakat);
  const existing = this.textForComparison && String(this.textForComparison).trim();
  if (!existing || this.isModified('text')) {
    this.textForComparison = plain;
  }
  next();
});

module.exports = mongoose.model('PracticePhrase', practicePhraseSchema);

