const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    dept_code: { 
        type: String, 
        unique: true, 
        required: [true, 'Department code is required'],
        trim: true
    },
    dept_name: { 
        type: String, 
        required: [true, 'Department name is required'],
        trim: true
    },
    office_location: { 
        type: String,
        trim: true
    },
    courses: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course' 
    }],
    professors: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Professor' 
    }],
    assistants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Assistant' 
    }],
    employees: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee' 
    }],
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }]
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);

