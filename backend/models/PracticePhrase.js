/**
 * PracticePhrase model: short Qur'anic phrases for recitation practice.
 */
const mongoose = require('mongoose');

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

module.exports = mongoose.model('PracticePhrase', practicePhraseSchema);

