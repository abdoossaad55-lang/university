// src/models/Assistant.js
const mongoose = require('mongoose');

const AssistantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
}, { timestamps: true });

module.exports = mongoose.model('Assistant', AssistantSchema);
