// src/models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    position: {
        type: String,
        enum: ["Student Affairs", "Registrar", "Finance", "Library"],
        default: "Student Affairs"
    },
    department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    office_location: String,
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
