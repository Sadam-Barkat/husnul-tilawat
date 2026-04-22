/**
 * Recitation routes: store and list user recitation sessions.
 */
const express = require('express');
const router = express.Router();
const Recitation = require('../models/Recitation');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/recitations
 * Save a recitation attempt for the logged-in user.
 * Body: { lessonId?: string, phraseId?: string, referenceText?: string, recognizedText: string }
 */
router.post('/', protect, async (req, res) => {
  try {
    const { lessonId, phraseId, referenceText, recognizedText } = req.body;
    if (!recognizedText || !recognizedText.trim()) {
      return res.status(400).json({ message: 'recognizedText is required' });
    }
    const rec = await Recitation.create({
      user: req.user._id,
      lesson: lessonId || undefined,
      phrase: phraseId || undefined,
      referenceText: referenceText || '',
      recognizedText: recognizedText.trim(),
    });
    res.status(201).json(rec);
  } catch (err) {
    res.status(500).json({ message: 'Failed to save recitation' });
  }
});

/**
 * GET /api/recitations/me
 * Get recent recitations for the logged-in user (for future progress views).
 */
router.get('/me', protect, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const recs = await Recitation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recitations' });
  }
});

module.exports = router;

