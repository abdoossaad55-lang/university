const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

const Assignment = require("../models/AssignmentModel");
const Course = require("../models/Course");
const Student = require("../models/Student");
const sendNotification = require("../utils/sendNotification");

const professorAuth = require("../middlewares/professorAuth");
const studentAuth = require("../middlewares/studentAuth");

// ------------------------------
// Multer Setup
// ------------------------------

// 1️⃣ Professor: Create Assignment
const professorStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join("uploads/assignments", req.body.courseId);
        await fs.ensureDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const professorUpload = multer({
    storage: professorStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        const allowed = [".pdf", ".doc", ".docx", ".zip"];
        if (!allowed.includes(path.extname(file.originalname).toLowerCase()))
            return cb(new Error("Invalid file type"));
        cb(null, true);
    }
});

// 2️⃣ Student: Submit Assignment
const studentStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const { assignmentId } = req.body;
            if (!assignmentId) return cb(new Error("assignmentId is required"));

            const assignment = await Assignment.findById(assignmentId).populate("course");
            if (!assignment) return cb(new Error("Assignment not found"));

            const uploadDir = path.join("uploads/assignments", assignment.course._id.toString());
            await fs.ensureDir(uploadDir);
            cb(null, uploadDir);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const studentUpload = multer({
    storage: studentStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [".pdf", ".doc", ".docx", ".zip"];
        if (!allowed.includes(path.extname(file.originalname).toLowerCase()))
            return cb(new Error("Invalid file type"));
        cb(null, true);
    }
});

// ------------------------------
// CREATE ASSIGNMENT (PROFESSOR)
// ------------------------------
router.post("/create", professorAuth, professorUpload.single("file"), async (req, res) => {
    try {
        const { title, description, deadline, courseId } = req.body;

        const course = await Course.findById(courseId).populate("students");
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        if (!course.professors.includes(req.user.id))
            return res.status(403).json({ success: false, message: "You do NOT teach this course" });

        const assignment = await Assignment.create({
            title,
            description,
            deadline,
            file: req.file ? `/uploads/assignments/${courseId}/${req.file.filename}` : null,
            course: courseId,
            professor: req.user.id
        });

        // Notify students
        for (const student of course.students) {
            await sendNotification(
                student._id,
                "Student",
                "New Assignment",
                `A new assignment "${title}" was uploaded for course ${course.name}`
            );
        }

        res.status(201).json({ success: true, message: "Assignment created", data: assignment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// LIST ASSIGNMENTS
// ------------------------------
router.post("/list", async (req, res) => {
    try {
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ success: false, message: "courseId is required" });

        const assignments = await Assignment.find({ course: courseId })
            .sort({ deadline: 1 })
            .populate("professor", "name email");

        res.json({ success: true, message: "Assignments fetched", data: assignments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// SUBMIT ASSIGNMENT (STUDENT)
// ------------------------------
router.post("/submit", studentAuth, studentUpload.single("file"), async (req, res) => {
    try {
        const { assignmentId } = req.body;
        if (!assignmentId) return res.status(400).json({ success: false, message: "assignmentId required" });

        const assignment = await Assignment.findById(assignmentId).populate("course");
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

        if (!assignment.course.students.includes(req.user.id))
            return res.status(403).json({ success: false, message: "You are not enrolled in this course" });

        const submission = {
            student: req.user.id,
            file: req.file ? `/uploads/assignments/${assignment.course._id}/${req.file.filename}` : null,
            submitted_at: new Date()
        };

        assignment.submissions.push(submission);
        await assignment.save();

        // Notify professor
        await sendNotification(
            assignment.professor,
            "Professor",
            "Assignment Submission",
            `Student submitted assignment "${assignment.title}"`
        );

        res.json({ success: true, message: "Assignment submitted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// LIST SUBMISSIONS (PROFESSOR)
// ------------------------------
router.post("/submissions/list", professorAuth, async (req, res) => {
    try {
        const { assignmentId } = req.body;
        if (!assignmentId) return res.status(400).json({ success: false, message: "assignmentId required" });

        const assignment = await Assignment.findById(assignmentId)
            .populate({ path: "submissions.student", select: "full_name email student_id avatar department_id" })
            .populate("course", "name code");

        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
        if (assignment.professor.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: "You do NOT own this assignment" });

        res.json({ success: true, message: "Submissions fetched", data: assignment.submissions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ------------------------------
// RESPOND TO SUBMISSION (PROFESSOR)
// ------------------------------
router.post("/submissions/respond", professorAuth, async (req, res) => {
    try {
        const { assignmentId, submissionId, grade, feedback } = req.body;
        if (!assignmentId || !submissionId)
            return res.status(400).json({ success: false, message: "assignmentId and submissionId required" });

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
        if (assignment.professor.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: "Unauthorized" });

        const submission = assignment.submissions.id(submissionId);
        if (!submission) return res.status(404).json({ success: false, message: "Submission not found" });

        if (grade !== undefined) submission.grade = grade;
        if (feedback) submission.feedback = feedback;
        submission.responded_at = new Date();

        await assignment.save();

        // Notify student
        await sendNotification(
            submission.student,
            "Student",
            "Assignment Feedback",
            `Your submission "${assignment.title}" has been graded.`
        );

        res.json({ success: true, message: "Response saved", data: submission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// ------------------------------
// LIST ALL ASSIGNMENTS OF LOGGED-IN PROFESSOR
// ------------------------------
router.get("/professor/assignments", professorAuth, async (req, res) => {
    try {
        const professorId = req.user.id;

        const assignments = await Assignment.find({ professor: professorId })
            .sort({ deadline: 1 })
            .populate("course", "name code");

        res.json({ 
            success: true, 
            message: "Assignments fetched successfully", 
            data: assignments 
        });
    } catch (err) {
        console.error("Fetch professor assignments error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
}); 

module.exports = router;
