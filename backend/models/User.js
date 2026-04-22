/**
 * User model for authentication and profile.
 * Used for Register, Login, and role-based access (user / admin).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // exclude from queries by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    /** false until email verified; omit/undefined treated as verified for legacy accounts */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationCodeHash: {
      type: String,
      select: false,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    verificationLastSentAt: {
      type: Date,
      select: false,
    },
    passwordResetCodeHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetLastSentAt: {
      type: Date,
      select: false,
    },
    /** Lessons where user passed pronunciation practice (unlocks next lesson) */
    practicePassedLessonIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
      default: [],
    },
  },
  { timestamps: true }
);

// Hash password before saving (register only; login uses compare)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
