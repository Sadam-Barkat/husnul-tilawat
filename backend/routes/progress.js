/**
 * Progress routes: aggregate lessons, quizzes, recitations, and streak for a user.
 */
const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const Recitation = require('../models/Recitation');
const QuizResult = require('../models/QuizResult');
const { protect } = require('../middleware/authMiddleware');

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * GET /api/progress/overview
 * Returns summary + simple time-series for the current user.
 */
router.get('/overview', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const [totalLessons, quizAgg, recAgg] = await Promise.all([
      Lesson.countDocuments({ isActive: true }),
      QuizResult.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            avgScore: { $avg: '$score' },
          },
        },
      ]),
      Recitation.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalRecitations: { $sum: 1 },
          },
        },
      ]),
    ]);

    const quizSummary = quizAgg[0] || { totalAttempts: 0, avgScore: null };
    const recSummary = recAgg[0] || { totalRecitations: 0 };

    // Lessons completed = lessons where user has at least one quiz with score >= 60
    const completedLessonDocs = await QuizResult.aggregate([
      { $match: { user: userId, score: { $gte: 60 } } },
      { $group: { _id: '$lessonId' } },
    ]);
    const completedLessons = completedLessonDocs.length;

    // Activity for last 7 days: per-day quizzes and recitations
    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const [quizPerDay, recPerDay] = await Promise.all([
      QuizResult.aggregate([
        {
          $match: {
            user: userId,
            createdAt: { $gte: sevenDaysAgo, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
              d: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
            avgScore: { $avg: '$score' },
          },
        },
      ]),
      Recitation.aggregate([
        {
          $match: {
            user: userId,
            createdAt: { $gte: sevenDaysAgo, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
              d: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const quizByKey = new Map();
    quizPerDay.forEach((r) => {
      const key = `${r._id.y}-${r._id.m}-${r._id.d}`;
      quizByKey.set(key, r);
    });
    const recByKey = new Map();
    recPerDay.forEach((r) => {
      const key = `${r._id.y}-${r._id.m}-${r._id.d}`;
      recByKey.set(key, r);
    });

    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const q = quizByKey.get(key);
      const r = recByKey.get(key);
      last7Days.push({
        date: d.toISOString(),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        quizzes: q ? q.count : 0,
        avgQuizScore: q && q.avgScore != null ? Math.round(q.avgScore) : null,
        recitations: r ? r.count : 0,
      });
    }

    // Streak: consecutive days up to today with any activity (quiz or recitation)
    let streak = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      const day = last7Days[i];
      if ((day.quizzes || 0) + (day.recitations || 0) > 0) {
        streak += 1;
      } else if (i === last7Days.length - 1) {
        // If today has no activity, streak is 0
        streak = 0;
        break;
      } else {
        break;
      }
    }

    res.json({
      lessons: {
        total: totalLessons,
        completed: completedLessons,
      },
      quizzes: {
        totalAttempts: quizSummary.totalAttempts || 0,
        avgScore: quizSummary.avgScore != null ? Math.round(quizSummary.avgScore) : null,
      },
      recitations: {
        total: recSummary.totalRecitations || 0,
      },
      last7Days,
      streakDays: streak,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch progress overview' });
  }
});

module.exports = router;

