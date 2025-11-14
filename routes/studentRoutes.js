// src/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const Student = require('../models/Student');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Assistant = require('../models/Assistant');
const sendEmail = require('../utils/sendEmail'); // optional
const auth = require('../middlewares/auth');

// multer storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const avatarDir = path.join(process.cwd(), UPLOAD_DIR, 'avatars');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

// helper to create student_id
const createStudentId = (full_name) => {
  const letters = full_name.replace(/\s+/g, '').substring(0,3).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${letters}${randomNum}`;
};

// GET all students
router.get('/', async (req, res) => {
  try {
    const students = await Student.find()
      .populate('department_id', 'dept_name dept_code')
      .populate({ path: 'courses', populate: ['professors','assistants','department']});
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// SIGNUP - allows optional avatar upload
router.post('/signup', upload.single('avatar'), async (req, res) => {
  try {
    const { full_name, email, password, confirm_password, department_id, year } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'full_name, email and password are required' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existing = await Student.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const student_id = createStudentId(full_name);

    const newStudent = new Student({
      student_id,
      full_name,
      email,
      password,
      department_id,
      enrollment_status: 'Active',
      year: year ? Number(year) : undefined
    });

    if (req.file) {
      // store relative path for serving
      newStudent.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await newStudent.save();

    res.status(201).json({
      message: 'Student registered successfully',
      student: {
        id: newStudent._id,
        student_id: newStudent.student_id,
        full_name: newStudent.full_name,
        email: newStudent.email,
        department_id: newStudent.department_id,
        year: newStudent.year,
        avatar: newStudent.avatar
      }
    });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ message: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email });
    if (!student) return res.status(404).json({ message: 'No account found' });

    const isMatch = await student.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: student._id, email: student.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      student: {
        id: student._id,
        full_name: student.full_name,
        email: student.email,
        student_id: student.student_id,
        enrollment_status: student.enrollment_status,
        courses: student.courses,
        professors: student.professors,
        assistants: student.assistants,
        department: student.department_id,
        year: student.year,
        avatar: student.avatar
      },
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET student by id
router.get('/id/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('department_id', 'dept_name dept_code')
      .populate({ path: 'courses', populate: ['professors','assistants','department']});
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE student (allow avatar upload)
router.put('/:id', upload.single('avatar'), async (req, res) => {
  try {
    const payload = { ...req.body };

    // don't allow password to be updated this way (unless you want)
    delete payload.password;

    if (req.file) {
      payload.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const updated = await Student.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate('department_id', 'dept_name dept_code');

    if (!updated) return res.status(404).json({ message: 'Student not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE student
router.delete('/:id', async (req, res) => {
  try {
    const removed = await Student.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Student not found' });
    // optionally remove references in courses
    await Course.updateMany({ students: removed._id }, { $pull: { students: removed._id }});
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Enroll and remove same as before (kept)
router.post('/:id/enroll/:courseId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    const course = await Course.findById(req.params.courseId);
    if (!student || !course) return res.status(404).json({ message: 'Student or Course not found' });

    if (!student.courses.includes(course._id)) {
      student.courses.push(course._id);
      course.students.push(student._id);
      await student.save();
      await course.save();
    }
    res.json({ message: 'Student enrolled successfully', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/remove-course/:courseId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    const course = await Course.findById(req.params.courseId);
    if (!student || !course) return res.status(404).json({ message: 'Student or Course not found' });

    student.courses = student.courses.filter(c => c.toString() !== course._id.toString());
    course.students = course.students.filter(s => s.toString() !== student._id.toString());
    await student.save();
    await course.save();
    res.json({ message: 'Student removed from course', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// academic-info route
router.get('/:id/academic-info', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'courses',
        populate: [
          { path: 'professors', model: 'Professor' },
          { path: 'assistants', model: 'Assistant' },
          { path: 'department', model: 'Department' }
        ]
      })
      .populate('department_id');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({
      student: student.full_name,
      department: student.department_id,
      courses: student.courses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// list by course
router.get('/course/:courseId', async (req, res) => {
  try {
    const students = await Student.find({ courses: req.params.courseId }).populate('department_id');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
