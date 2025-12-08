// src/controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const Student = require("../models/Student");

// ----------------------
// PROFESSOR: MARK ATTENDANCE
// ----------------------
exports.markAttendance = async (req, res) => {
  try {
    const { courseId, date, attendanceList } = req.body;

    if (!courseId || !date || !attendanceList || !Array.isArray(attendanceList)) {
      return res.status(400).json({
        success: false,
        message: "courseId, date, attendanceList are required"
      });
    }

    const course = await Course.findById(courseId)
      .populate("students", "_id full_name")
      .populate("professors", "_id");

    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    // ensure professor teaches course
    if (!course.professors.map(p => p._id.toString()).includes(req.user.id)) {
      return res.status(403).json({ success: false, message: "You are not assigned to this course" });
    }

    // 🔥 increase number of lectures
    course.totalLectures += 1;
    await course.save();

    const invalidStudents = [];
    const bulkOps = [];

    for (const { studentId, student_name, status } of attendanceList) {

      const student = course.students.find(
        s => s._id.toString() === studentId && s.full_name.toLowerCase() === student_name.toLowerCase()
      );

      if (!student) {
        invalidStudents.push({
          studentId,
          student_name,
          reason: "Student not in course or name mismatch"
        });
        continue;
      }

      // 🔥 Store attendance record
      bulkOps.push({
        updateOne: {
          filter: { course: courseId, student: studentId, date },
          update: { status, markedBy: req.user.id },
          upsert: true
        }
      });

      // 🔥 Update student attendance stats
      const stu = await Student.findById(studentId);

      const stats = stu.attendanceStats.get(courseId) || {
        present: 0,
        absent: 0,
        percentage: 0
      };

      if (status === "Present") stats.present++;
      else stats.absent++;

      // Recalculate %
      const total = stats.present + stats.absent;
      stats.percentage = total > 0 ? (stats.present / total) * 100 : 0;

      stu.attendanceStats.set(courseId, stats);
      await stu.save();
    }

    if (bulkOps.length > 0) await Attendance.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: "Attendance recorded & statistics updated",
      processedStudents: bulkOps.length,
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


// ================================
// GET STUDENTS ENROLLED IN A COURSE
// ================================
exports.getStudentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required"
      });
    }

    // Find course and populate students
    const course = await Course.findById(courseId)
      .populate("students", "_id full_name email student_id");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    res.json({
      success: true,
      students: course.students
    });

  } catch (err) {
    console.error("getStudentsByCourse error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



// =======================================================
// PROFESSOR: GET FULL ATTENDANCE REPORT FOR A COURSE
// =======================================================
exports.getCourseAttendanceReport = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ 
        success: false, 
        message: "courseId is required" 
      });
    }

    const course = await Course.findById(courseId)
      .populate("students", "_id full_name attendanceStats")
      .populate("professors", "_id");

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: "Course not found" 
      });
    }

    // Ensure professor teaches this course
    if (!course.professors.map(p => p._id.toString()).includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this course"
      });
    }

    // Find last attendance date for each student
    const records = await Attendance.find({ course: courseId })
      .sort({ date: -1 })
      .lean();

    // Build a map of studentId → lastDate
    const lastDates = {};
    for (const rec of records) {
      if (!lastDates[rec.student]) {
        lastDates[rec.student] = rec.date;
      }
    }

    // Build final report
    const report = course.students.map(stu => {
      const stats = stu.attendanceStats?.get(courseId.toString()) || {
        present: 0,
        absent: 0,
        percentage: 0
      };

      return {
        studentId: stu._id,
        name: stu.full_name,
        present: stats.present,
        absent: stats.absent,
        percentage: stats.percentage.toFixed(2),
        lastAttendance: lastDates[stu._id] || null
      };
    });

    res.json({
      success: true,
      totalStudents: report.length,
      totalLectures: course.totalLectures,
      report
    });

  } catch (err) {
    console.error("getCourseAttendanceReport error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};



