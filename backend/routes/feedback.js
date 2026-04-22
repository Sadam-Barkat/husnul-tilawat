/**
 * Feedback routes: submit and list feedback.
 */
const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/feedback
 * Create feedback from the logged-in user.
 * Body: { rating: number 1-5, message: string }
 */
router.post('/', protect, async (req, res) => {
  try {
    const { rating, message } = req.body;
    if (!rating || !message) {
      return res.status(400).json({ message: 'Rating and message are required' });
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      rating,
      message,
      userName: req.user.name,
      userEmail: req.user.email,
    });

    res.status(201).json(feedback);
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

/**
 * GET /api/feedback
 * Get recent feedback entries, newest first.
 * Intended for homepage/testimonials display.
 */
router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const feedback = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch feedback' });
  }
});

module.exports = router;

