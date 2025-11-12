const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

// ✅ Create new course
router.post('/', async (req, res) => {
    try {
        const course = await Course.create(req.body);
        res.status(201).json(course);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ✅ Get all courses (with population)
router.get('/', async (req, res) => {
    try {
        const courses = await Course.find()
        .populate('department professors assistants students');
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Get single course
router.get('/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
        .populate('department professors assistants students');
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Update course
router.put('/:id', async (req, res) => {
    try {
        const updated = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ✅ Delete course
router.delete('/:id', async (req, res) => {
    try {
        await Course.findByIdAndDelete(req.params.id);
        res.json({ message: 'Course deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
