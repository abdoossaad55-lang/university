const mongoose = require('mongoose');

const LectureSlidesSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true,
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Professor",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
});

const LectureSlides = mongoose.model('LectureSlides', LectureSlidesSchema);

module.exports = LectureSlides;