// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // attach user minimal info
        req.user = { id: payload.id, email: payload.email };
        // optionally load full user
        req.currentStudent = await Student.findById(payload.id).select('-password');
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = auth;
