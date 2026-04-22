/**
 * Profile routes: Protected routes for user profile.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

/**
 * GET /api/profile/me
 * Protected route to get the logged-in user's profile
 */
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is attached by the protect middleware
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

module.exports = router;
