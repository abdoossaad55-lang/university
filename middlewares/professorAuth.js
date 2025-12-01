// src/middlewares/professorAuth.js
const { verifyAccessToken } = require('../utils/token');
const Professor = require('../models/Professor');

const professorAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = header.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      console.error('Professor auth token error:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Accept lowercase role names and tolerate either 'professor' or 'admin'
    const role = (payload.role || '').toString().toLowerCase();
    if (role !== 'professor' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Find professor by id from token payload
    const professor = await Professor.findById(payload.id);
    if (!professor || professor.isDeleted) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Normalize req.user using the authoritative DB values (so role is accurate)
    req.user = { id: professor._id.toString(), email: professor.email, role: (professor.role || 'professor').toString().toLowerCase() };
    req.currentProfessor = professor;

    next();
  } catch (err) {
    console.error('Professor auth error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = professorAuth;
