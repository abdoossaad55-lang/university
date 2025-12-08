const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const Student = require("../models/Student");

// =======================================================
// GET attendance summary for all courses (dashboard)
// =======================================================
exports.getMyAttendanceSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    const student = await Student.findById(studentId)
      .populate("courses", "name totalLectures");

    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const summary = student.courses.map(course => {
      const stats = student.attendanceStats?.get(course._id.toString()) || {
        present: 0,
        absent: 0,
        percentage: 0
      };
      return {
        courseId: course._id,
        courseName: course.name,
        present: stats.present,
        absent: stats.absent,
        percentage: stats.percentage.toFixed(2),
        totalLectures: course.totalLectures
      };
    });

    res.json({ success: true, courses: summary });
  } catch (err) {
    console.error("getMyAttendanceSummary error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET full attendance for a specific course
// =======================================================
exports.getMyCourseAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) return res.status(400).json({ success: false, message: "courseId is required" });

    const records = await Attendance.find({ course: courseId, student: studentId })
      .populate("markedBy", "name email")
      .sort({ date: 1 });

    const summary = records.reduce((acc, rec) => {
      acc.total++;
      acc[rec.status] = (acc[rec.status] || 0) + 1;
      return acc;
    }, { total: 0, Present: 0, Absent: 0, Late: 0, Excused: 0 });

    summary.percentage = summary.total > 0 ? ((summary.Present / summary.total) * 100).toFixed(2) : 0;

    res.json({ success: true, data: records, summary });
  } catch (err) {
    console.error("getMyCourseAttendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET attendance in a date range
// =======================================================
exports.getMyAttendanceInRange = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId, from, to } = req.body;

    const query = { student: studentId };
    if (courseId) query.course = courseId;
    if (from || to) query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);

    const records = await Attendance.find(query)
      .populate("course", "name code")
      .populate("markedBy", "name email")
      .sort({ date: 1 });

    res.json({ success: true, data: records, total: records.length });
  } catch (err) {
    console.error("getMyAttendanceInRange error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET attendance warnings (<75%)
// =======================================================
exports.getAttendanceWarnings = async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await Student.findById(studentId)
      .populate("courses", "name totalLectures");

    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const warnings = student.courses.map(course => {
      const stats = student.attendanceStats?.get(course._id.toString()) || { percentage: 0 };
      if (stats.percentage < 75) {
        return {
          courseId: course._id,
          courseName: course.name,
          percentage: stats.percentage.toFixed(2),
          status: "At risk"
        };
      }
      return null;
    }).filter(Boolean);

    res.json({ success: true, warnings });
  } catch (err) {
    console.error("getAttendanceWarnings error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET attendance chart data (for frontend graphs)
// =======================================================
exports.getAttendanceChartData = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ success: false, message: "courseId required" });

    const records = await Attendance.find({ student: studentId, course: courseId })
      .sort({ date: 1 })
      .lean();

    const chartData = {
      dates: records.map(r => r.date.toISOString().split("T")[0]),
      status: records.map(r => r.status === "Present" ? 1 : 0)
    };

    res.json({ success: true, chartData });
  } catch (err) {
    console.error("getAttendanceChartData error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// OPTIONAL: Download attendance PDF
// =======================================================
const PDFDocument = require('pdfkit');
exports.downloadAttendancePDF = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ success: false, message: "courseId required" });

    const student = await Student.findById(studentId).populate("courses", "name");
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const records = await Attendance.find({ student: studentId, course: courseId })
      .sort({ date: 1 });

    const stats = student.attendanceStats?.get(courseId.toString()) || { present: 0, absent: 0, percentage: 0 };

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${course.name}_attendance.pdf"`);

    doc.pipe(res);

    doc.fontSize(18).text(`${student.full_name} Attendance Report`, { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Course: ${course.name}`);
    doc.text(`Total Lectures: ${course.totalLectures}`);
    doc.text(`Present: ${stats.present}`);
    doc.text(`Absent: ${stats.absent}`);
    doc.text(`Percentage: ${stats.percentage.toFixed(2)}%`);
    doc.moveDown();

    doc.text("Lecture Records:", { underline: true });
    records.forEach(r => {
      doc.text(`${r.date.toISOString().split("T")[0]} - ${r.status}`);
    });

    doc.end();

  } catch (err) {
    console.error("downloadAttendancePDF error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
