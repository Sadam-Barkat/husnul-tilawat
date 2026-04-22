/**
 * Admin API — all routes under /api/admin
 * Auth: Bearer JWT + role admin.
 *
 * Capabilities:
 * - Feedback: list, delete (no update)
 * - Users: list, get one, update (no create), delete
 * - Lessons: full CRUD (incl. inactive)
 * - Practice phrases (pronunciation): full CRUD
 * - Quiz questions: full CRUD
 * - Recitations: list (read)
 * - Dashboard stats summary
 */
const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Lesson = require('../models/Lesson');
const PracticePhrase = require('../models/PracticePhrase');
const QuizQuestion = require('../models/QuizQuestion');
const Recitation = require('../models/Recitation');
const QuizResult = require('../models/QuizResult');

const router = express.Router();
router.use(protect, requireAdmin);

function toPlainArabic(s) {
  return (s || '')
    .replace(/\u0671/g, '\u0627')
    .replace(/[\u064B-\u0652\u0640\u0670]/g, '')
    .trim();
}

function parsePageLimit(req) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// ---------- Dashboard ----------
router.get('/stats', async (req, res) => {
  try {
    const [users, admins, lessons, feedback, phrases, questions, recitations, quizAttempts] =
      await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'admin' }),
        Lesson.countDocuments(),
        Feedback.countDocuments(),
        PracticePhrase.countDocuments(),
        QuizQuestion.countDocuments(),
        Recitation.countDocuments(),
        QuizResult.countDocuments(),
      ]);
    res.json({
      users,
      admins,
      lessons,
      feedback,
      practicePhrases: phrases,
      quizQuestions: questions,
      recitations,
      quizAttempts,
    });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

// ---------- Feedback (delete only; no update) ----------
router.get('/feedback', async (req, res) => {
  try {
    const { page, limit, skip } = parsePageLimit(req);
    const [items, total] = await Promise.all([
      Feedback.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list feedback' });
  }
});

router.delete('/feedback/:id', async (req, res) => {
  try {
    const doc = await Feedback.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Feedback not found' });
    res.json({ message: 'Feedback deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete feedback' });
  }
});

// ---------- Users (no create) ----------
router.get('/users', async (req, res) => {
  try {
    const { page, limit, skip } = parsePageLimit(req);
    const q = (req.query.search || '').trim();
    /** Learners only — admin accounts are not listed (manage admins via DB / seed). */
    const filter = { role: { $ne: 'admin' } };
    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: new RegExp(esc, 'i') }, { email: new RegExp(esc, 'i') }];
    }
    const [items, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list users' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: 'Failed to load user' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { name, email, role, newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (email && email !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase().trim() });
      if (exists) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase().trim();
    }
    if (typeof name === 'string') user.name = name.trim();
    if (role === 'user' || role === 'admin') {
      if (user._id.equals(req.user._id) && role === 'user') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot remove last admin' });
        }
      }
      user.role = role;
    }
    if (newPassword && typeof newPassword === 'string') {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      user.password = newPassword;
    }
    await user.save();
    const out = user.toObject();
    delete out.password;
    res.json(out);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete last admin' });
      }
    }
    await Promise.all([
      Feedback.deleteMany({ user: id }),
      Recitation.deleteMany({ user: id }),
      QuizResult.deleteMany({ user: id }),
      User.findByIdAndDelete(id),
    ]);
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// ---------- Lessons ----------
router.get('/lessons', async (req, res) => {
  try {
    const includeInactive = req.query.all === '1' || req.query.all === 'true';
    const q = includeInactive ? {} : { isActive: true };
    const { page, limit, skip } = parsePageLimit(req);
    const [items, total] = await Promise.all([
      Lesson.find(q).sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
      Lesson.countDocuments(q),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list lessons' });
  }
});

router.get('/lessons/:id', async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json(lesson);
  } catch (e) {
    res.status(500).json({ message: 'Failed to load lesson' });
  }
});

router.post('/lessons', async (req, res) => {
  try {
    const lesson = await Lesson.create(req.body);
    res.status(201).json(lesson);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to create lesson' });
  }
});

router.put('/lessons/:id', async (req, res) => {
  try {
    const updated = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Lesson not found' });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to update lesson' });
  }
});

router.delete('/lessons/:id', async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    await Promise.all([
      lesson.deleteOne(),
      QuizQuestion.deleteMany({ lessonId: lesson._id }),
      QuizResult.deleteMany({ lessonId: lesson._id }),
    ]);
    await User.updateMany({}, { $pull: { practicePassedLessonIds: lesson._id } });
    res.json({ message: 'Lesson deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete lesson' });
  }
});

// ---------- Practice phrases (pronunciation) ----------
router.get('/practice-phrases', async (req, res) => {
  try {
    const { page, limit, skip } = parsePageLimit(req);
    const [items, total] = await Promise.all([
      PracticePhrase.find().sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
      PracticePhrase.countDocuments(),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list practice phrases' });
  }
});

router.post('/practice-phrases', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.text && !body.textForComparison) {
      body.textForComparison = toPlainArabic(body.text);
    }
    const doc = await PracticePhrase.create(body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to create phrase' });
  }
});

router.put('/practice-phrases/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.text != null && body.textForComparison == null) {
      body.textForComparison = toPlainArabic(body.text);
    }
    const doc = await PracticePhrase.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: 'Phrase not found' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to update phrase' });
  }
});

router.delete('/practice-phrases/:id', async (req, res) => {
  try {
    const doc = await PracticePhrase.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Phrase not found' });
    res.json({ message: 'Phrase deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete phrase' });
  }
});

// ---------- Quiz questions ----------
router.get('/quiz/questions', async (req, res) => {
  try {
    const { lessonId } = req.query;
    const filter = lessonId && mongoose.isValidObjectId(lessonId) ? { lessonId } : {};
    const { page, limit, skip } = parsePageLimit(req);
    const [items, total] = await Promise.all([
      QuizQuestion.find(filter).sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
      QuizQuestion.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list quiz questions' });
  }
});

router.post('/quiz/questions', async (req, res) => {
  try {
    const doc = await QuizQuestion.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to create question' });
  }
});

router.put('/quiz/questions/:id', async (req, res) => {
  try {
    const doc = await QuizQuestion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: 'Question not found' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Failed to update question' });
  }
});

router.delete('/quiz/questions/:id', async (req, res) => {
  try {
    const doc = await QuizQuestion.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete question' });
  }
});

// ---------- Recitations (read-only list) ----------
router.get('/recitations', async (req, res) => {
  try {
    const { page, limit, skip } = parsePageLimit(req);
    const filter = {};
    if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) {
      filter.user = req.query.userId;
    }
    const [items, total] = await Promise.all([
      Recitation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email')
        .populate('lesson', 'title')
        .populate('phrase', 'label')
        .lean(),
      Recitation.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list recitations' });
  }
});

module.exports = router;
