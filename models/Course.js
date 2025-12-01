// src/models/Course.js
const mongoose = require('mongoose');
// src/models/Course.js
const CourseSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    credits: { type: Number, default: 3 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Professor' }],
    assistants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assistant' }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Assignment" }] ,
    // Add this ↓ for grades
    grades: [
        {
            student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
            grade: { type: Number, required: true },
            professor: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor' }, // optional: who assigned the grade
            createdAt: { type: Date, default: Date.now }
        }
    ]

}, { timestamps: true });


module.exports = mongoose.model('Course', CourseSchema);
