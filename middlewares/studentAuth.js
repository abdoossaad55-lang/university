// src/middlewares/studentAuth.js
const { verifyAccessToken } = require('../utils/token');
const Student = require('../models/Student');

const studentAuth = async (req, res, next) => {
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
      console.error('Student auth token error:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // role check (case-insensitive)
    if ((payload.role || '').toString().toLowerCase() !== 'student') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const student = await Student.findById(payload.id);
    if (!student || student.isDeleted) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = { id: student._id.toString(), email: student.email, role: 'student' };
    req.currentStudent = student;

    next();
  } catch (err) {
    console.error('Student auth error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = studentAuth;
