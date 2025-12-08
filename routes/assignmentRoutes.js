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
const Professor = require("../models/Professor");

// ------------------------------
// Multer Setup
// ------------------------------

// 1️⃣ Professor: Create Assignment
const professorStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const courseId = req.query.courseId; // <-- use query param now
        if (!courseId) return cb(new Error("courseId query parameter is required"));

        const uploadDir = path.join("uploads/assignments", courseId);
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
            const { assignmentId } = req.body; // <-- read from form-data
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
// UPLOAD ASSIGNMENT (PROFESSOR)
// ------------------------------
router.post("/upload", professorAuth, professorUpload.single("file"), async (req, res) => {
    try {
        const { title, description, deadline } = req.body;
        const courseId = req.query.courseId;

        // ✅ Validate file and required fields
        if (!req.file) 
            return res.status(400).json({ success: false, message: "No file uploaded" });
        if (!courseId || !title || !deadline)
            return res.status(400).json({ success: false, message: "courseId, title, and deadline are required" });

        // ✅ Check professor
        const professor = await Professor.findById(req.user.id);
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });

        if (!professor.courses.includes(courseId))
            return res.status(403).json({ success: false, message: "You do NOT teach this course" });

        // ✅ Create assignment
        const assignment = await Assignment.create({
            course: courseId,
            professor: req.user.id,
            title,
            description,
            deadline,
            file: `/uploads/assignments/${courseId}/${req.file.filename}`,
            submissions: []
        });

        // ✅ Notify students
        const course = await Course.findById(courseId).populate("students");
        for (const student of course.students) {
            await sendNotification(
                student._id,
                "Student",
                "New Assignment",
                `New assignment uploaded: ${title}`
            );
        }

        res.status(201).json({ success: true, message: "Assignment uploaded successfully", data: assignment });
    } catch (err) {
        console.error("Upload assignment error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// SUBMIT ASSIGNMENT (STUDENT)
// ------------------------------
router.post("/submit", studentAuth, studentUpload.single("file"), async (req, res) => {
    try {
        const { assignmentId } = req.body; // <-- read from body
        if (!assignmentId) 
            return res.status(400).json({ success: false, message: "assignmentId is required in body" });

        const assignment = await Assignment.findById(assignmentId).populate({
            path: "course",
            select: "name code students"
        });
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

        // Compare as strings
        const isEnrolled = assignment.course.students.some(
            student => student.toString() === req.user.id
        );
        if (!isEnrolled)
            return res.status(403).json({ success: false, message: "You are not enrolled in this course" });

        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const submission = {
            student: req.user.id,
            file: `/uploads/assignments/${assignment.course._id}/${req.file.filename}`,
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

        res.json({ success: true, message: "Assignment submitted successfully", data: submission });
    } catch (err) {
        console.error("Submit assignment error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// LIST ASSIGNMENTS FOR STUDENT (SPECIFIC COURSE)
// ------------------------------
router.post("/list", studentAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.body;

    if (!courseId)
      return res.status(400).json({ success: false, message: "courseId is required in body" });

    // Check if course exists
    const course = await Course.findById(courseId).populate("students");
    if (!course)
      return res.status(404).json({ success: false, message: "Course not found" });

    // Check if student is enrolled
    if (!course.students.some(s => s._id.toString() === studentId))
      return res.status(403).json({ success: false, message: "You are not enrolled in this course" });

    // Fetch assignments for this course, excluding submissions
    const assignmentsRaw = await Assignment.find({ course: courseId })
      .sort({ deadline: 1 })
      .select("-submissions") // ❌ Exclude submissions
      .populate("professor", "full_name email"); // Include only needed professor info

    res.json({
      success: true,
      message: "Assignments fetched successfully",
      data: assignmentsRaw
    });
  } catch (err) {
    console.error("Fetch student assignments error:", err);
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


// ------------------------------
// GET ASSIGNMENTS BY COURSE ID (PROFESSOR)
// ------------------------------
router.post("/professor/assignments/course", professorAuth, async (req, res) => {
    try {
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ success: false, message: "courseId is required" });

        const professorId = req.user.id;

        const assignments = await Assignment.find({
            course: courseId,
            professor: professorId
        })
        .sort({ deadline: 1 })
        .populate("course", "name code");

        res.json({
            success: true,
            message: "Assignments fetched successfully",
            data: assignments
        });
    } catch (err) {
        console.error("Fetch assignments by course error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});



module.exports = router;
