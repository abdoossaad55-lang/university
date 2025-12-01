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
    destination: function (req, file, cb) {
      cb(null, avatarDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
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
