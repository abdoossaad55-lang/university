// src/utils/multerConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const ensureDir = async (dir) => {
  await fs.ensureDir(dir);
};

function avatarUploader(options = {}) {
  const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
  const avatarDir = path.join(process.cwd(), UPLOAD_DIR, 'avatars');
  ensureDir(avatarDir);

  const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // courseId might be in req.body if you parse fields first
    const courseId = req.body.courseId;
    if (!courseId) return cb(new Error("courseId is required"), null);

    const uploadDir = path.join("uploads/slides", courseId);
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

  const fileFilter = (req, file, cb) => {
    // validate by mimetype first
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('Only images (jpeg, jpg, png) are allowed'));
    }
    cb(null, true);
  };

  const limits = { fileSize: options.maxSize || 2 * 1024 * 1024 };

  return multer({ storage, fileFilter, limits });
}

module.exports = {
  avatarUploader
};
