const mongoose = require("mongoose");

const SemesterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // e.g., "Fall 2025"
        trim: true
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    is_active: {
        type: Boolean,
        default: false // Only one active semester at a time
    },
    description: {
        type: String,
        default: ""
    },
    courses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course"
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model("Semester", SemesterSchema);
