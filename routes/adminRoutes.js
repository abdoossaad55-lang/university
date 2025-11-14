const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.delete('/clear', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    res.json({ message: 'Database cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;