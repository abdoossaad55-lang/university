// src/models/Attendance.js
const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    date: { type: Date, required: true },
    status: {
        type: String,
        enum: ["Present", "Absent", "Late", "Excused"],
        default: "Absent"
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Professor" }
}, { timestamps: true });

// Ensure unique attendance per student per course per date
AttendanceSchema.index({ course: 1, student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
