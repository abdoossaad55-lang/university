const express = require('express');
const router = express.Router();
const Assistant = require('../models/Assistant');

router.post('/', async (req, res) => {
    try {
        const assistant = await Assistant.create(req.body);
        res.status(201).json(assistant);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const assistants = await Assistant.find()
        .populate('departments')
        .populate('courses');
        res.json(assistants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const assistant = await Assistant.findById(req.params.id)
        .populate('departments courses');
        if (!assistant) return res.status(404).json({ message: 'Assistant not found' });
        res.json(assistant);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updated = await Assistant.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Assistant.findByIdAndDelete(req.params.id);
        res.json({ message: 'Assistant deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
