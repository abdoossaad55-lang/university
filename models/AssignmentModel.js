const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    file: String, // uploaded file PDF/Doc/etc
    deadline: { type: Date, required: true },

    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    professor: { type: mongoose.Schema.Types.ObjectId, ref: "Professor", required: true },

    submissions: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
        file: String,
        submitted_at: Date
    }]
}, { timestamps: true });

module.exports = mongoose.model("Assignment", AssignmentSchema);
