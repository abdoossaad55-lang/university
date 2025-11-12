const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    credits: { type: Number, default: 3 },

    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },

    professors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professor'
    }],
    assistants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assistant'
    }],
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }]
});

module.exports = mongoose.model('Course', CourseSchema);
