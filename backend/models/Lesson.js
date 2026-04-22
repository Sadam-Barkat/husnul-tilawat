/**
 * Lesson model for Tajweed learning content.
 * Stores lesson metadata, rule summary, example text, and optional audio URL.
 */
const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Lesson slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    category: {
      type: String,
      trim: true,
    },
    ruleSummary: {
      type: String,
      trim: true,
    },
    arabicText: {
      /** With harakat — shown in UI and TTS */
      type: String,
      trim: true,
    },
    arabicTextForComparison: {
      /** Plain Arabic only (no zabar/zeer/pesh etc.) — used for pronunciation matching */
      type: String,
      trim: true,
    },
    translation: {
      type: String,
      trim: true,
    },
    audioUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lesson', lessonSchema);

