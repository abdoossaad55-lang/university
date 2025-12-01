const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

const LectureSlides = require("../models/LectureSlidesModel");
const Professor = require("../models/Professor");
const Course = require("../models/Course");
const sendNotification = require("../utils/sendNotification");

const professorAuth = require("../middlewares/professorAuth");
const studentAuth = require("../middlewares/studentAuth");

// ------------------------------
// Multer storage
// ------------------------------
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const courseId = req.body.courseId;
        const uploadDir = path.join("uploads/slides", courseId);
        await fs.ensureDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        const allowed = [".pdf", ".ppt", ".pptx", ".doc", ".docx"];
        if (!allowed.includes(path.extname(file.originalname).toLowerCase()))
            return cb(new Error("Invalid file type"));
        cb(null, true);
    }
});

// ------------------------------
// UPLOAD SLIDE (PROFESSOR)
// ------------------------------
router.post("/upload", professorAuth, upload.single("file"), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
        if (!courseId || !title) return res.status(400).json({ success: false, message: "courseId and title are required" });

        const professor = await Professor.findById(req.user.id);
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });

        if (!professor.courses.includes(courseId))
            return res.status(403).json({ success: false, message: "You do NOT teach this course" });

        const slide = await LectureSlides.create({
            course: courseId,
            professor: req.user.id,
            title,
            fileUrl: `/uploads/slides/${courseId}/${req.file.filename}`
        });

        // Notify students
        const course = await Course.findById(courseId).populate("students");
        for (const student of course.students) {
            await sendNotification(
                student._id,
                "Student",
                "New Lecture Slide",
                `New slide uploaded: ${title}`
            );
        }

        res.status(201).json({ success: true, message: "Slide uploaded successfully", data: slide });
    } catch (err) {
        console.error("Upload slide error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// LIST SLIDES (STUDENT)
// ------------------------------
router.post("/list", studentAuth, async (req, res) => {
    try {
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ success: false, message: "courseId is required" });

        const slides = await LectureSlides.find({ course: courseId })
            .sort({ uploadedAt: -1 })
            .populate("professor", "name email");

        res.json({ success: true, message: "Slides fetched", data: slides });
    } catch (err) {
        console.error("List slides error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
