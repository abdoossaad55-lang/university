// src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/faculty_management';
  console.log('🧩 Connecting to MongoDB URI:', uri);

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
    });
    console.log('✅ MongoDB connected successfully');
    console.log('📚 DB:', mongoose.connection.name, 'host:', mongoose.connection.host);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
