// src/routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const professorAuth = require("../middlewares/professorAuth");
const studentAuth = require("../middlewares/studentAuth");
const adminAuth = require("../middlewares/adminAuth");
const attendanceController = require("../controllers/attendanceController");

// ----------------------
// PROFESSOR MARK ATTENDANCE
// ----------------------
router.post("/mark", professorAuth, attendanceController.markAttendance);

// ----------------------
// VIEW ATTENDANCE BY COURSE (Professor/Admin)
// ----------------------
router.get("/course", professorAuth, attendanceController.getAttendanceByCourse);
router.get("/course/admin", adminAuth, attendanceController.getAttendanceByCourse);

// ----------------------
// STUDENT VIEW THEIR OWN ATTENDANCE
// ----------------------
router.get("/me", studentAuth, attendanceController.getStudentAttendance);


// ================================
// GET STUDENTS ENROLLED IN A COURSE
// ================================
router.post("/students", professorAuth, attendanceController.getStudentsByCourse);


// =======================================================
// PROFESSOR: GET FULL ATTENDANCE REPORT FOR A COURSE
// =======================================================
router.post("/report", professorAuth, attendanceController.getCourseAttendanceReport);


module.exports = router;
