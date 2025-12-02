// src/controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const Student = require("../models/Student");

// ----------------------
// PROFESSOR: MARK ATTENDANCE
// ----------------------
// ----------------------
// PROFESSOR: MARK ATTENDANCE (with student_name validation)
// ----------------------
exports.markAttendance = async (req, res) => {
  try {
    const { courseId, date, attendanceList } = req.body;

    if (!courseId || !date || !attendanceList || !Array.isArray(attendanceList))
      return res.status(400).json({ success: false, message: "courseId, date, and attendanceList are required" });

    const course = await Course.findById(courseId).populate("students", "_id full_name");
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    // Check professor teaches the course
    if (!course.professors.includes(req.user.id))
      return res.status(403).json({ success: false, message: "You are not assigned to this course" });

    const invalidStudents = [];
    const bulkOps = [];

    for (const { studentId, student_name, status } of attendanceList) {
      if (!studentId || !student_name || !status) {
        invalidStudents.push({ studentId, student_name, reason: "Missing required field" });
        continue;
      }

      // Validate student exists in the course
      const student = course.students.find(
        s => s._id.toString() === studentId && s.full_name.toLowerCase() === student_name.toLowerCase()
      );

      if (!student) {
        invalidStudents.push({ studentId, student_name, reason: "Student not enrolled in course or name mismatch" });
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { course: courseId, student: studentId, date },
          update: { status, markedBy: req.user.id },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: "Attendance recorded successfully",
      processed: bulkOps.length,
      invalidStudents
    });
  } catch (err) {
    console.error("markAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ----------------------
// PROFESSOR/ADMIN: VIEW ATTENDANCE BY COURSE
// ----------------------
exports.getAttendanceByCourse = async (req, res) => {
    try {
        const { courseId, date } = req.body;

        if (!courseId) return res.status(400).json({ success: false, message: "courseId is required in body" });

        const query = { course: courseId };
        if (date) query.date = date;

        const records = await Attendance.find(query)
            .populate("student", "full_name student_id email")
            .populate("markedBy", "name email")
            .sort({ date: 1 });

        // Calculate summary
        const summary = records.reduce((acc, rec) => {
            acc.total++;
            acc[rec.status] = (acc[rec.status] || 0) + 1;
            return acc;
        }, { total: 0, Present: 0, Absent: 0, Late: 0, Excused: 0 });

        summary.percentage = summary.total > 0 ? ((summary.Present / summary.total) * 100).toFixed(2) : 0;

        res.json({ success: true, data: records, summary });
    } catch (err) {
        console.error("getAttendanceByCourse error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ----------------------
// STUDENT: VIEW THEIR ATTENDANCE
// ----------------------
exports.getStudentAttendance = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { courseId } = req.body;

        const query = { student: studentId };
        if (courseId) query.course = courseId;

        const records = await Attendance.find(query)
            .populate("course", "name code")
            .populate("markedBy", "name email")
            .sort({ date: 1 });

        // Summary statistics
        const summary = records.reduce((acc, rec) => {
            acc.total++;
            acc[rec.status] = (acc[rec.status] || 0) + 1;
            return acc;
        }, { total: 0, Present: 0, Absent: 0, Late: 0, Excused: 0 });

        summary.percentage = summary.total > 0 ? ((summary.Present / summary.total) * 100).toFixed(2) : 0;

        res.json({ success: true, data: records, summary });
    } catch (err) {
        console.error("getStudentAttendance error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
