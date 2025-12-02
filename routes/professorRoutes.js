const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const professorController = require('../controllers/professorController');
const professorAuth = require('../middlewares/professorAuth');
const adminAuth = require('../middlewares/adminAuth');

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads/professors');
fs.ensureDirSync(uploadDir);

// Multer setup for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
});
const upload = multer({ storage });

// ------------------------------
// AUTH ROUTES
// ------------------------------
router.post('/signup', upload.single('avatar'), professorController.signup);
router.post('/login', professorController.login);
router.post('/refresh-token', professorController.refreshToken);
router.post('/logout', professorAuth, professorController.logout);
router.post('/forgot-password', professorController.forgotPassword);
router.post('/reset-password', professorController.resetPassword);

// ------------------------------
// PROFILE ROUTES
// ------------------------------
router.get('/me', professorAuth, professorController.me);
router.put('/me', professorAuth, upload.single('avatar'), professorController.updateProfile);
router.patch('/me/change-password', professorAuth, professorController.changePassword);
router.delete('/me', professorAuth, professorController.removeProfessor);

// ------------------------------
// ADMIN-ONLY ROUTES
// ------------------------------
router.get('/', professorAuth, adminAuth, professorController.listProfessors);
router.patch('/courses/assign', professorAuth, professorController.assignCourses);

// ------------------------------
// COURSES & GRADES ROUTES
// ------------------------------
router.post('/submitGrades', professorAuth, professorController.submitGrades); // by ID array
router.post('/submitGradesByIdAndName', professorAuth, professorController.submitGradesByIdAndName); // by ID + Name
router.post('/submitGradeById', professorAuth, professorController.submitGradeById); // single student
router.post('/courses/students', professorAuth, professorController.getStudentsInCourse);
router.get('/dashboard', professorAuth, professorController.dashboard);
router.get('/courses', professorAuth, professorController.getMyCourses);

module.exports = router;
