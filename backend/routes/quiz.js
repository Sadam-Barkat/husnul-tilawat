/**
 * Quiz routes: random questions per lesson, submit answers, quiz history.
 */
const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const QuizQuestion = require('../models/QuizQuestion');
const QuizResult = require('../models/QuizResult');
const { protect } = require('../middleware/authMiddleware');

const DEFAULT_QUESTIONS_PER_QUIZ = 5;

// Seed default questions for a lesson when it has none (generic Tajweed pool)
async function seedQuestionsForLesson(lessonId) {
  const count = await QuizQuestion.countDocuments({ lessonId });
  if (count > 0) return;

  const pool = [
    { questionText: "What is the Makhraj (articulation point) of the letter 'ب' (Ba)?", options: ["Throat", "Both lips", "Tip of tongue", "Nose"], correctIndex: 1 },
    { questionText: "How many counts should a natural Madd be held?", options: ["1 count", "2 counts", "4 counts", "6 counts"], correctIndex: 1 },
    { questionText: "Ghunnah is a nasal sound that comes from:", options: ["The throat", "The nose", "The lips", "The chest"], correctIndex: 1 },
    { questionText: "Which rule applies when Noon Saakin is followed by 'ي'?", options: ["Ikhfaa", "Iqlaab", "Idghaam with Ghunnah", "Izhaar"], correctIndex: 2 },
    { questionText: "The letter 'ح' is pronounced from:", options: ["The lips", "Middle of the throat", "The tip of the tongue", "Back of the tongue"], correctIndex: 1 },
    { questionText: "What does Idghaam mean?", options: ["Hiding", "Merging", "Clear pronunciation", "Changing"], correctIndex: 1 },
    { questionText: "Which letter is pronounced with the tip of the tongue touching the upper teeth?", options: ["ق", "ط", "ل", "ن"], correctIndex: 2 },
    { questionText: "Tafkheem (heavy sound) applies to the letter:", options: ["س", "ص", "ه", "ي"], correctIndex: 1 },
  ];

  const docs = pool.map((q, i) => ({
    lessonId,
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    order: i,
  }));
  await QuizQuestion.insertMany(docs);
}

/**
 * GET /api/quiz/questions?lessonId=...
 * Returns N random questions for the lesson (no correctIndex). Seeds defaults if none exist.
 */
router.get('/questions', protect, async (req, res) => {
  try {
    const lessonId = req.query.lessonId;
    if (!lessonId) {
      return res.status(400).json({ message: 'lessonId is required' });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    await seedQuestionsForLesson(lessonId);

    const all = await QuizQuestion.find({ lessonId }).lean();
    const limit = Math.min(DEFAULT_QUESTIONS_PER_QUIZ, all.length);
    const shuffled = all.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, limit).map(({ _id, questionText, options }) => ({
      _id,
      questionText,
      options,
    }));

    res.json(selected);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

/**
 * POST /api/quiz/submit
 * Body: { lessonId, answers: [{ questionId, selectedIndex }] }
 * Returns score and saves result.
 */
router.post('/submit', protect, async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    if (!lessonId || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'lessonId and answers array required' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const questionIds = answers.map((a) => a.questionId);
    const questions = await QuizQuestion.find({
      _id: { $in: questionIds },
      lessonId,
    }).lean();

    if (questions.length !== answers.length) {
      return res.status(400).json({ message: 'Invalid answers: question count mismatch' });
    }

    const byId = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));
    let correctCount = 0;
    const selectedIndices = [];
    const correctPerQuestion = [];
    for (const a of answers) {
      const q = byId[a.questionId];
      if (!q || typeof a.selectedIndex !== 'number') continue;
      selectedIndices.push(a.selectedIndex);
      const correct = q.correctIndex === a.selectedIndex;
      if (correct) correctCount++;
      correctPerQuestion.push(correct);
    }

    const totalQuestions = questions.length;
    const score = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

    await QuizResult.create({
      user: req.user._id,
      lessonId,
      score,
      totalQuestions,
      answers: selectedIndices,
    });

    res.json({
      score,
      correctCount,
      totalQuestions,
      correctPerQuestion,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to submit quiz' });
  }
});

/**
 * GET /api/quiz/history
 * Returns current user's quiz results with lesson title, newest first.
 */
router.get('/history', protect, async (req, res) => {
  try {
    const results = await QuizResult.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('lessonId', 'title')
      .lean();

    const list = results.map((r) => ({
      _id: r._id,
      lessonId: r.lessonId?._id,
      lessonTitle: r.lessonId?.title || 'Lesson',
      score: r.score,
      totalQuestions: r.totalQuestions,
      correctCount: r.totalQuestions ? Math.round((r.score / 100) * r.totalQuestions) : 0,
      createdAt: r.createdAt,
    }));

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quiz history' });
  }
});

module.exports = router;
