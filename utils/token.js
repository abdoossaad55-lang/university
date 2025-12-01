// utils/token.js
const jwt = require('jsonwebtoken');

const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || '7d';

// ensure secrets exist (fail fast)
if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment');
}
if (!process.env.REFRESH_SECRET) {
  // you can choose to allow fallback but it's safer to require a separate secret
  throw new Error('Missing REFRESH_SECRET in environment');
}

function _idOf(user) {
  // Accept user._id or user.id or plain id string
  return user && (user.id || (user._id && user._id.toString()) || user);
}

/**
 * Generate JWT access token
 * user may be { id/_id, email, role } or just id string (not recommended)
 */
function generateAccessToken(user) {
  const id = _idOf(user);
  if (!id) throw new Error('User id is required for access token');

  const role = (user && user.role) || 'student'; // default fallback if omitted
  const payload = {
    id,
    role,
    email: (user && user.email) || undefined
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  const id = _idOf(user);
  if (!id) throw new Error('User id is required for refresh token');

  const role = (user && user.role) || 'student';
  const payload = {
    id,
    role,
    email: (user && user.email) || undefined,
    type: 'refresh'
  };
  return jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
