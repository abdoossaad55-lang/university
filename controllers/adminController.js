const Student = require("../models/Student");
const Professor = require("../models/Professor");
const Course = require("../models/Course");
const Assignment = require("../models/AssignmentModel");
const LectureSlides = require("../models/LectureSlidesModel");
const Notification = require("../models/Notification");
const Semester = require("../models/Semester");
const fs = require("fs-extra");



const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");

// Helper to create JWT
const generateToken = (admin) => {
    return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// -----------------
// SIGNUP
// -----------------
exports.signup = async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) return res.status(400).json({ success: false, message: "Email already exists" });

        const admin = await Admin.create({ full_name, email, password });
        const token = generateToken(admin);

        res.status(201).json({ success: true, data: { admin, token } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------
// LOGIN
// -----------------
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(401).json({ success: false, message: "Invalid credentials" });

        const isMatch = await admin.matchPassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });

        const token = generateToken(admin);
        res.json({ success: true, data: { admin, token } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};


// -----------------------------
// STUDENT MANAGEMENT
// -----------------------------
exports.listStudents = async (req, res) => {
    try {
        const students = await Student.find().populate("courses", "name code");
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.body.id).populate("courses");
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });
        res.json({ success: true, data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });
        res.json({ success: true, data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });
        res.json({ success: true, message: "Student deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleStudentStatus = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });
        student.active = !student.active;
        await student.save();
        res.json({ success: true, message: `Student ${student.active ? "activated" : "deactivated"}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// PROFESSOR MANAGEMENT
// -----------------------------
exports.listProfessors = async (req, res) => {
    try {
        const professors = await Professor.find().populate("courses", "name code");
        res.json({ success: true, data: professors });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getProfessor = async (req, res) => {
    try {
        const professor = await Professor.findById(req.params.id).populate("courses");
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });
        res.json({ success: true, data: professor });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateProfessor = async (req, res) => {
    try {
        const professor = await Professor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });
        res.json({ success: true, data: professor });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteProfessor = async (req, res) => {
    try {
        const professor = await Professor.findByIdAndDelete(req.params.id);
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });
        res.json({ success: true, message: "Professor deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleProfessorStatus = async (req, res) => {
    try {
        const professor = await Professor.findById(req.params.id);
        if (!professor) return res.status(404).json({ success: false, message: "Professor not found" });
        professor.active = !professor.active;
        await professor.save();
        res.json({ success: true, message: `Professor ${professor.active ? "activated" : "deactivated"}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// COURSE MANAGEMENT
// -----------------------------
exports.listCourses = async (req, res) => {
    try {
        const courses = await Course.find().populate("professors students");
        res.json({ success: true, data: courses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).populate("professors students assignments");
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });
        res.json({ success: true, data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createCourse = async (req, res) => {
    try {
        const course = await Course.create(req.body);
        res.status(201).json({ success: true, data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });
        res.json({ success: true, data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });
        res.json({ success: true, message: "Course deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.assignProfessorsToCourse = async (req, res) => {
    try {
        const { professorIds } = req.body;
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        course.professors = professorIds;
        await course.save();
        res.json({ success: true, message: "Professors assigned", data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.enrollStudentsToCourse = async (req, res) => {
    try {
        const { studentIds } = req.body;
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        course.students = studentIds;
        await course.save();
        res.json({ success: true, message: "Students enrolled", data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// ASSIGNMENTS MANAGEMENT
// -----------------------------
exports.listAllAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find().populate("professor course");
        res.json({ success: true, data: assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.overrideAssignmentGrade = async (req, res) => {
    try {
        const { grade, feedback } = req.body;
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

        const submission = assignment.submissions.id(req.params.submissionId);
        if (!submission) return res.status(404).json({ success: false, message: "Submission not found" });

        if (grade !== undefined) submission.grade = grade;
        if (feedback) submission.feedback = feedback;

        await assignment.save();
        res.json({ success: true, message: "Grade overridden", data: submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// LECTURE SLIDES MANAGEMENT
// -----------------------------
exports.listAllSlides = async (req, res) => {
    try {
        const slides = await LectureSlides.find().populate("professor course");
        res.json({ success: true, data: slides });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteSlide = async (req, res) => {
    try {
        const slide = await LectureSlides.findByIdAndDelete(req.params.id);
        if (!slide) return res.status(404).json({ success: false, message: "Slide not found" });

        // Remove file from disk
        if (slide.fileUrl) await fs.remove(slide.fileUrl.replace("/", ""));
        res.json({ success: true, message: "Slide deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// NOTIFICATIONS MANAGEMENT
// -----------------------------
exports.sendNotification = async (req, res) => {
    try {
        const { userId, userType, title, message } = req.body;
        const notification = await Notification.create({ user: userId, userType, title, message });
        res.json({ success: true, message: "Notification sent", data: notification });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.listNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 });
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// -----------------------------
// SEMESTER MANAGEMENT
// -----------------------------
exports.listSemesters = async (req, res) => {
    try {
        const semesters = await Semester.find();
        res.json({ success: true, data: semesters });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createSemester = async (req, res) => {
    try {
        const semester = await Semester.create(req.body);
        res.status(201).json({ success: true, data: semester });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSemester = async (req, res) => {
    try {
        const semester = await Semester.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: semester });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// ------------------------------
// SEND GLOBAL ANNOUNCEMENT
// ------------------------------
exports.sendGlobalNotification = async (req, res) => {
    try {
        const { title, message } = req.body;
        if (!title || !message)
            return res.status(400).json({ success: false, message: "Title and message are required" });

        // Fetch all students and professors
        const students = await Student.find({}, "_id");
        const professors = await Professor.find({}, "_id");

        const recipients = [...students.map(s => s._id), ...professors.map(p => p._id)];

        const notifications = recipients.map(userId => ({
            user: userId,
            userModel: userId instanceof Student ? "Student" : "Professor",
            title,
            message,
            type: "global",
            status: "sent",
            createdBy: req.user.id
        }));

        await Notification.insertMany(notifications);

        res.json({ success: true, message: "Global notification sent", count: notifications.length });
    } catch (err) {
        console.error("Send global notification error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ------------------------------
// SCHEDULE NOTIFICATION
// ------------------------------
exports.scheduleNotification = async (req, res) => {
    try {
        const { title, message, recipients, recipientModel, scheduledAt } = req.body;
        if (!title || !message || !scheduledAt)
            return res.status(400).json({ success: false, message: "Title, message, and scheduledAt required" });

        const notification = await Notification.create({
            title,
            message,
            user: recipients || [], // optional for system-wide
            userModel: recipientModel || "Student",
            type: recipients ? "individual" : "global",
            status: "pending",
            scheduledAt,
            createdBy: req.user.id
        });

        res.json({ success: true, message: "Notification scheduled", data: notification });
    } catch (err) {
        console.error("Schedule notification error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ------------------------------
// VIEW NOTIFICATION STATUS
// ------------------------------
exports.getNotificationStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id)
            .populate("user", "full_name email name");

        if (!notification)
            return res.status(404).json({ success: false, message: "Notification not found" });

        res.json({ success: true, data: notification });
    } catch (err) {
        console.error("Get notification status error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
