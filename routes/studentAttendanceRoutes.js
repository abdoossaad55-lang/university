const express = require("express");
const router = express.Router();
const studentAuth = require("../middlewares/studentAuth");
const studentController = require("../controllers/studentAttendanceController");


console.log("dsflkjdsbhfjsd")
// Dashboard summary
router.get("/me/summary", studentAuth, studentController.getMyAttendanceSummary);

// Full attendance for a course
router.post("/me/course", studentAuth, studentController.getMyCourseAttendance);

// Attendance in a date range
router.post("/me/range", studentAuth, studentController.getMyAttendanceInRange);

// Attendance warnings (<75%)
router.get("/me/warnings", studentAuth, studentController.getAttendanceWarnings);

// Attendance chart data
router.post("/me/chart", studentAuth, studentController.getAttendanceChartData);

// Download PDF report
router.get("/me/report/pdf", studentAuth, studentController.downloadAttendancePDF);

module.exports = router;
