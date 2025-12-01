const express = require('express');
const router = express.Router();
const studentAuth = require('../middlewares/studentAuth');
const adminAuth = require('../middlewares/adminAuth');

const studentController = require('../controllers/studentController');
const Student = require("../models/Student");
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Ensure upload folder exists
const uploadDir = path.join(process.cwd(), 'uploads/students');
fs.ensureDirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Public
router.post('/signup', upload.single('avatar'), studentController.signup);
router.post('/login', studentController.login);
router.post('/refresh', studentController.refreshToken);
router.post('/forgot-password', studentController.forgotPassword);
router.post('/reset-password', studentController.resetPassword);

// Protected Student routes
router.get('/me', studentAuth, studentController.me);
router.put('/me', studentAuth, upload.single('avatar'), studentController.updateProfile);
router.post('/change-password', studentAuth, studentController.changePassword);
router.post('/logout', studentAuth, studentController.logout);

router.post('/enroll', studentAuth, studentController.enrollCourse);
router.delete('/remove-course', studentAuth, studentController.removeCourse);
router.get('/grades', studentAuth, studentController.getGrades);
router.get('/dashboard', studentAuth, studentController.dashboard);

// Admin Only
router.get('/', adminAuth, studentController.listStudents);
router.delete('/:id', adminAuth, studentController.removeStudent);

router.get("/courses", studentAuth, async (req, res) => {
    try {
        const student = await Student.findById(req.user.id)
            .populate("courses", "name code description");

        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        res.json({
            success: true,
            message: "Courses fetched successfully",
            data: student.courses
        });
    } catch (err) {
        console.error("Fetch student courses error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});



module.exports = router;
