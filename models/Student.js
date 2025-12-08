// src/models/Student.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const LoginHistorySchema = new mongoose.Schema({
  ip: String,
  userAgent: String,
  success: Boolean,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
  student_id: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true
  },
  full_name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number'],
  },
  attendanceStats: {
  type: Map,
  of: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  default: {}
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  dob: Date,
  department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  address: { type: String, trim: true },
  enrollment_status: {
    type: String,
    enum: ['Active', 'Inactive', 'Graduated', 'Suspended'],
    default: 'Active'
  },

  // authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },

  // role (needed for tokens & auth)
  role: { type: String, enum: ['student'], default: 'student' },

  // refresh tokens (simple storage). In more secure systems you may hash them.
  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],

  // password reset
  resetToken: String,
  resetTokenExpire: Date,

  // login attempts & history
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  lastPasswordChange: Date,
  loginHistory: [LoginHistorySchema],

  // soft delete
  isDeleted: { type: Boolean, default: false },

  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  professors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Professor' }],
  assistants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assistant' }],

  year: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    default: 1
  },
  avatar: {
    type: String,
    default: null
  },

  // optional analytics
  gpa: { type: Number, default: null },
  completedCredits: { type: Number, default: 0 }

}, { timestamps: true });

// Virtual id for easier usage (so controllers can use user.id)
StudentSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Ensure virtuals are included when converting to JSON
StudentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    // remove sensitive fields
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.resetToken;
    delete ret.resetTokenExpire;
    delete ret.__v;
    return ret;
  }
});

// Hash password before save
StudentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

StudentSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add refresh token
StudentSchema.methods.addRefreshToken = async function (token) {
  this.refreshTokens.push({ token });
  // keep only last 10 tokens
  if (this.refreshTokens.length > 10) this.refreshTokens.shift();
  await this.save();
};

// Remove refresh token (logout)
StudentSchema.methods.removeRefreshToken = async function (token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  await this.save();
};

// Clear all refresh tokens (e.g., after password change)
StudentSchema.methods.clearRefreshTokens = async function () {
  this.refreshTokens = [];
  await this.save();
};

module.exports = mongoose.model('Student', StudentSchema);
