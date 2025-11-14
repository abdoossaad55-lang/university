// src/models/Attendance.js
const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Present', 'Absent', 'Excused'], default: 'Present' }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
