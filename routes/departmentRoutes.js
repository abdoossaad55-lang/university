const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Assistant = require('../models/Assistant');
const Student = require('../models/Student');

// ✅ Create a new department
router.post('/', async (req, res) => {
    try {
        const department = await Department.create(req.body);
        res.status(201).json(department);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ✅ Get all departments with populated data
router.get('/', async (req, res) => {
    try {
        const departments = await Department.find()
        .populate('courses')
        .populate('professors')
        .populate('assistants')
        .populate('students');
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Get a single department by ID
router.get('/:id', async (req, res) => {
    try {
        const department = await Department.findById(req.params.id)
        .populate('courses professors assistants students');
        if (!department) return res.status(404).json({ message: 'Department not found' });
        res.json(department);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Update department
router.put('/:id', async (req, res) => {
    try {
        const updated = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    } 
});

// ✅ Delete department
router.delete('/:id', async (req, res) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
