const express = require('express');
const router = express.Router();
const Professor = require('../models/Professor');

// ✅ Add professor
router.post('/', async (req, res) => {
    try {
        const prof = await Professor.create(req.body);
        res.status(201).json(prof);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ✅ Get all professors with related data
router.get('/', async (req, res) => {
    try {
        const profs = await Professor.find()
        .populate('departments')
        .populate('courses');
        res.json(profs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Get single professor
router.get('/:id', async (req, res) => {
    try {
        const prof = await Professor.findById(req.params.id)
        .populate('departments courses');
        if (!prof) return res.status(404).json({ message: 'Professor not found' });
        res.json(prof);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ Update professor
router.put('/:id', async (req, res) => {
    try {
        const updated = await Professor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ✅ Delete professor
router.delete('/:id', async (req, res) => {
    try {
        await Professor.findByIdAndDelete(req.params.id);
        res.json({ message: 'Professor deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
