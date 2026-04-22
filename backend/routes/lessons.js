/**
 * Lesson routes: CRUD for Tajweed lessons.
 * Public learner endpoints are protected so only authenticated users can access lessons.
 * Admin-only endpoints allow managing lesson content.
 */
const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const PRACTICE_PASS_SCORE = 70;

// Simple admin check using user role from JWT payload
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * GET /api/lessons/progress/me
 * Lesson IDs the user passed via pronunciation practice (must be before /:id).
 */
router.get('/progress/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('practicePassedLessonIds').lean();
    const ids = (user && user.practicePassedLessonIds) || [];
    res.json({ passedLessonIds: ids.map((id) => id.toString()) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load lesson progress' });
  }
});

/**
 * POST /api/lessons/practice-pass
 * Body: { lessonId, score } — score >= 70 and all lower-order lessons must be passed first.
 */
router.post('/practice-pass', protect, async (req, res) => {
  try {
    const { lessonId, score } = req.body;
    if (!lessonId || typeof score !== 'number') {
      return res.status(400).json({ message: 'lessonId and score required' });
    }
    if (score < PRACTICE_PASS_SCORE) {
      return res.status(400).json({ message: `Need at least ${PRACTICE_PASS_SCORE}% to pass` });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    const user = await User.findById(req.user._id);
    const passed = new Set((user.practicePassedLessonIds || []).map((id) => id.toString()));
    if (passed.has(lessonId)) {
      return res.json({ ok: true, alreadyPassed: true, passedLessonIds: [...passed] });
    }
    const prevLessons = await Lesson.find({
      isActive: true,
      order: { $lt: lesson.order },
    }).lean();
    for (const p of prevLessons) {
      if (!passed.has(p._id.toString())) {
        return res.status(403).json({ message: 'Complete previous lessons in order first' });
      }
    }
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { practicePassedLessonIds: lessonId },
    });
    const updated = await User.findById(req.user._id).select('practicePassedLessonIds').lean();
    res.json({
      ok: true,
      newlyPassed: true,
      passedLessonIds: (updated.practicePassedLessonIds || []).map((id) => id.toString()),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to record practice pass' });
  }
});

/**
 * GET /api/lessons
 * Get all active lessons for learners.
 */
router.get('/', protect, async (req, res) => {
  try {
    const lessons = await Lesson.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch lessons' });
  }
});

/**
 * GET /api/lessons/:id
 * Get a single lesson by id.
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(lesson);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch lesson' });
  }
});

/**
 * POST /api/lessons
 * Create a new lesson (admin only).
 */
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const lesson = await Lesson.create(req.body);
    res.status(201).json(lesson);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create lesson' });
  }
});

/**
 * PUT /api/lessons/:id
 * Update an existing lesson (admin only).
 */
router.put('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const updated = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update lesson' });
  }
});

/**
 * DELETE /api/lessons/:id
 * Soft delete or remove a lesson (admin only).
 */
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    await lesson.deleteOne();
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete lesson' });
  }
});

module.exports = router;

