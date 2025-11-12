const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Student = require("../models/Student");
const Course = require("../models/Course");
const Professor = require("../models/Professor");
const Assistant = require("../models/Assistant");
const sendEmail = require("../utils/sendEmail");

// 🟢 GET all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().populate("department_id");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 POST signup (register new student)
router.post("/signup", async (req, res) => {
  try {
    const { full_name, email, password, confirm_password, department_id } = req.body;

    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const student_id = `${full_name.substring(0, 3).toUpperCase()}${randomNum}`;

    const newStudent = new Student({
      student_id,
      full_name,
      email,
      password,
      confirm_password,
      department_id,
      enrollment_status: "Active",
    });

    await newStudent.save();

    res.status(201).json({
      message: "Student registered successfully",
      student: {
        id: newStudent._id,
        student_id: newStudent.student_id,
        full_name: newStudent.full_name,
        email: newStudent.email,
        department_id: newStudent.department_id,
        enrollment_status: newStudent.enrollment_status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 POST login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: student._id, email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      student: {
        full_name: student.full_name,
        email: student.email,
        department: student.department_id,
        enrollment_status: student.enrollment_status,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 GET student by ID
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate("department_id");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 POST new student (manual add by admin)
router.post("/", async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 🟢 PUT update student
router.put("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 🟢 DELETE student
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🧹 DELETE all students (admin)
router.delete("/", async (req, res) => {
  try {
    const result = await Student.deleteMany({});
    res.json({
      message: "All students deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 POST /api/students/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    student.resetToken = resetToken;
    student.resetTokenExpire = Date.now() + 15 * 60 * 1000;
    await student.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${student.full_name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" target="_blank">Reset Password</a>
      <p>This link will expire in 15 minutes.</p>
    `;

    await sendEmail(student.email, "Password Reset Request", html);
    res.json({ message: "Reset link sent to your email." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Something went wrong." });
  }
});

// 🟢 POST /api/students/reset-password/:token
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword)
      return res.status(400).json({ message: "Please provide both newPassword and confirmPassword." });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match." });

    const student = await Student.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!student)
      return res.status(400).json({ message: "Invalid or expired reset token." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    student.password = hashedPassword;
    student.confirm_password = hashedPassword;
    student.resetToken = undefined;
    student.resetTokenExpire = undefined;

    await student.save();

    res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error, please try again later." });
  }
});


// NEW FEATURES BELOW 

// ✅ Enroll a student in a course
router.post("/:id/enroll/:courseId", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    const course = await Course.findById(req.params.courseId);

    if (!student || !course) {
      return res.status(404).json({ message: "Student or Course not found" });
    }

    if (!student.courses.includes(course._id)) {
      student.courses.push(course._id);
      course.students.push(student._id);
      await student.save();
      await course.save();
    }

    res.json({ message: "Student enrolled successfully", student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Remove a student from a course
router.delete("/:id/remove-course/:courseId", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    const course = await Course.findById(req.params.courseId);

    if (!student || !course) {
      return res.status(404).json({ message: "Student or Course not found" });
    }

    student.courses = student.courses.filter(c => c.toString() !== course._id.toString());
    course.students = course.students.filter(s => s.toString() !== student._id.toString());

    await student.save();
    await course.save();

    res.json({ message: "Student removed from course", student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get all student academic info (courses + professors + assistants)
router.get("/:id/academic-info", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: "courses",
        populate: [
          { path: "professors", model: "Professor" },
          { path: "assistants", model: "Assistant" },
          { path: "department", model: "Department" }
        ]
      })
      .populate("department_id");

    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({
      student: student.full_name,
      department: student.department_id,
      courses: student.courses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ✅ Get all students enrolled in a specific course
router.get("/course/:courseId", async (req, res) => {
  try {
    const students = await Student.find({ courses: req.params.courseId })
      .populate("department_id");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
