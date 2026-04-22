/**
 * Quiz result: one attempt per user per quiz (lesson).
 */
const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    answers: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

quizResultSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);
