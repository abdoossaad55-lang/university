// src/models/Professor.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ProfessorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: String,
    title: { type: String, enum: ['Dr.', 'Prof.', 'Eng.'] },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['professor', 'admin'], default: 'professor' },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
    isDeleted: { type: Boolean, default: false },
    avatar: String,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    loginHistory: [{ ip: String, userAgent: String, success: Boolean, date: { type: Date, default: Date.now } }],
    resetToken: String,
    resetTokenExpire: Date,
    professor_id: String
}, { timestamps: true });

// Virtual id like Student model
ProfessorSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Hide sensitive info and include virtuals
ProfessorSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.resetToken;
    delete ret.resetTokenExpire;
    delete ret.__v;
    return ret;
  }
});

// Hash password on save
ProfessorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Password comparison helper
ProfessorSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Refresh token helpers
ProfessorSchema.methods.addRefreshToken = async function(token) {
    this.refreshTokens.push({ token });
    if (this.refreshTokens.length > 10) this.refreshTokens.shift();
    return this.save();
};

ProfessorSchema.methods.removeRefreshToken = async function(token) {
    this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
    return this.save();
};

ProfessorSchema.methods.clearRefreshTokens = async function() {
    this.refreshTokens = [];
    return this.save();
};

module.exports = mongoose.model('Professor', ProfessorSchema);
