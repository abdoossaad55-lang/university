// src/models/Student.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
    student_id: {
        type: String,
        required: [true, 'Student ID is required'],
        unique: true,
        trim: true
    },
    full_name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number'],
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    dob: Date,
    department_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },
    address: { type: String, trim: true },
    enrollment_status: {
        type: String,
        enum: ['Active', 'Inactive', 'Graduated', 'Suspended'],
        default: 'Active'
    },

    // authentication
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters']
    },

    resetToken: String,
    resetTokenExpire: Date,

    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Professor' }],
    assistants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assistant' }],

    year: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
        default: 1
    },
    avatar: { 
        type: String,
        default: null
    },

}, { timestamps: true });


StudentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
    });

    StudentSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', StudentSchema);
