/**
 * Recitation model: stores a user's recorded recitation session.
 */
const mongoose = require('mongoose');

const recitationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
    },
    phrase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PracticePhrase',
    },
    referenceText: {
      type: String,
      trim: true,
    },
    recognizedText: {
      type: String,
      trim: true,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recitation', recitationSchema);

