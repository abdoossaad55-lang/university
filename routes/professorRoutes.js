const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const professorController = require('../controllers/professorController');
const professorAuth = require('../middlewares/professorAuth');
const adminAuth = require('../middlewares/adminAuth');
const Professor = require("../models/Professor");

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads/professors');
fs.ensureDirSync(uploadDir);

// Multer setup for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
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
router.post('/grades', professorAuth, professorController.submitGrades);
router.post('/courses/grades-by-name', professorAuth, professorController.submitGradesByName);
router.post('/courses/students', professorAuth, professorController.getStudentsInCourse);
router.get('/dashboard', professorAuth, professorController.dashboard);

router.get("/courses", professorAuth, async (req, res) => {
    try {
        const professor = await Professor.findById(req.user.id)
            .populate("courses", "name code description");

        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });

        res.json({
            success: true,
            message: "Courses fetched successfully",
            data: professor.courses
        });
    } catch (err) {
        console.error("Fetch professor courses error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
