// src/models/AcademicRecord.js
const mongoose = require('mongoose');

const AcademicRecordSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    grade: { type: String }, // e.g. A, B, C or number
    semester: String,
    year: Number
}, { timestamps: true });

module.exports = mongoose.model('AcademicRecord', AcademicRecordSchema);
