const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const Joi = require('joi');

const Professor = require('../models/Professor');
const Course = require('../models/Course');
const Student = require('../models/Student');

const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { success, error } = require('../utils/response');
const sendEmail = require('../utils/sendEmail');

const avatarBasePath = '/uploads/professors';

// ==============================
// Helper: generate Professor ID
function createProfessorId(name) {
  const letters = (name.replace(/\s+/g, '').substring(0, 3) || 'PROF').toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${letters}${randomNum}${suffix}`;
}

// ==============================
// Validation Schemas
const signupSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirm_password: Joi.any().valid(Joi.ref('password')).required(),
  title: Joi.string().valid('Dr.', 'Prof.', 'Eng.').required(),
  departments: Joi.array().items(Joi.string()).default([]),
  courses: Joi.array().items(Joi.string()).default([])
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ==============================
// SIGNUP
async function signup(req, res) {
  try {
    const { error: vErr } = signupSchema.validate(req.body);
    if (vErr) return error(res, vErr.details[0].message, 400);

    const { name, email, password, title, departments, courses } = req.body;

    const exists = await Professor.findOne({ email: email.toLowerCase() });
    if (exists) return error(res, 'Email already registered', 400);

    const professorId = createProfessorId(name);

    const prof = await Professor.create({
      name,
      email: email.toLowerCase(),
      password,
      title,
      departments,
      courses,
      professor_id: professorId,
      avatar: req.file ? `${avatarBasePath}/${req.file.filename}` : null
    });

    // Assign professor to courses and students
    if (courses.length > 0) {
      await Course.updateMany({ _id: { $in: courses } }, { $addToSet: { professors: prof._id } });
      const courseDocs = await Course.find({ _id: { $in: courses } });
      await Promise.all(courseDocs.map(c =>
        Student.updateMany({ _id: { $in: c.students } }, { $addToSet: { professors: prof._id } })
      ));
    }

    const accessToken = generateAccessToken({ id: prof._id.toString(), role: 'professor', email: prof.email });
    const refreshToken = generateRefreshToken({ id: prof._id.toString(), role: 'professor', email: prof.email });
    await prof.addRefreshToken(refreshToken);

    success(res, { professor: prof, tokens: { accessToken, refreshToken } }, 'Professor registered successfully');
  } catch (err) {
    console.error('Signup error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// LOGIN
async function login(req, res) {
  try {
    const { error: vErr } = loginSchema.validate(req.body);
    if (vErr) return error(res, vErr.details[0].message, 400);

    const { email, password } = req.body;

    // Fetch professor & populate related fields
    const prof = await Professor.findOne({ email: email.toLowerCase() })
      .populate("departments")
      .populate("courses");

    if (!prof) return error(res, "No account found", 404);

    if (prof.lockedUntil && new Date() < new Date(prof.lockedUntil))
      return error(res, "Account temporarily locked due to failed login attempts", 403);

    const isMatch = await prof.comparePassword(password);

    // Log attempt
    prof.loginHistory = prof.loginHistory || [];
    prof.loginHistory.push({
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: !!isMatch,
    });

    // Handle failed login
    if (!isMatch) {
      prof.loginAttempts = (prof.loginAttempts || 0) + 1;
      if (prof.loginAttempts >= 5) {
        prof.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        prof.loginAttempts = 0;
      }
      await prof.save();
      return error(res, "Invalid credentials", 401);
    }

    // Success → reset lock
    prof.loginAttempts = 0;
    prof.lockedUntil = null;
    await prof.save();

    // Generate tokens
    const accessToken = generateAccessToken({ id: prof.id, role: "professor", email: prof.email });
    const refreshToken = generateRefreshToken({ id: prof.id, role: "professor", email: prof.email });
    await prof.addRefreshToken(refreshToken);

    // Build formatted response
    const formattedProfessor = {
      id: prof.id,
      full_name: prof.full_name,
      email: prof.email,
      departments: prof.departments?.map(d => d._id),
      courses: prof.courses?.map(c => c._id),
      avatar: prof.avatar,
      office: prof.office,
      phone: prof.phone
    };

    return res.status(200).json({
      message: "Login successful",
      professor: formattedProfessor,
      token: accessToken
    });

  } catch (err) {
    console.error("Login error:", err);
    return error(res, "Server error", 500);
  }
}

// ==============================
// REFRESH TOKEN
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'refreshToken is required', 400);

    let payload;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { return error(res, 'Invalid refresh token', 401); }

    const prof = await Professor.findById(payload.id);
    if (!prof) return error(res, 'Professor not found', 404);

    if (!prof.refreshTokens.some(t => t.token === refreshToken))
      return error(res, 'Refresh token not recognized', 401);

    const accessToken = generateAccessToken({ id: prof._id, role: 'professor', email: prof.email });
    const newRefreshToken = generateRefreshToken({ id: prof._id, role: 'professor', email: prof.email });

    await prof.removeRefreshToken(refreshToken);
    await prof.addRefreshToken(newRefreshToken);

    success(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (err) {
    console.error('Refresh token error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// LOGOUT
async function logout(req, res) {
  try {
    const prof = await Professor.findById(req.user.id);
    if (!prof) return error(res, 'Professor not found', 404);

    const { refreshToken } = req.body || {};
    if (refreshToken) await prof.removeRefreshToken(refreshToken);
    else await prof.clearRefreshTokens();

    success(res, null, 'Logged out successfully');
  } catch (err) {
    console.error('Logout error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// FORGOT PASSWORD
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email is required', 400);

    const prof = await Professor.findOne({ email: email.toLowerCase() });
    if (!prof) return error(res, 'No account found', 404);

    const token = crypto.randomBytes(20).toString('hex');
    prof.resetToken = token;
    prof.resetTokenExpire = Date.now() + 3600000;
    await prof.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    const html = `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`;
    await sendEmail(prof.email, 'Password reset', html);

    success(res, null, 'Password reset email sent');
  } catch (err) {
    console.error('Forgot password error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// RESET PASSWORD
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return error(res, 'token and password required', 400);

    const prof = await Professor.findOne({ resetToken: token, resetTokenExpire: { $gt: Date.now() } });
    if (!prof) return error(res, 'Invalid or expired token', 400);

    prof.password = password;
    prof.resetToken = undefined;
    prof.resetTokenExpire = undefined;
    await prof.clearRefreshTokens();
    await prof.save();

    success(res, null, 'Password reset successfully');
  } catch (err) {
    console.error('Reset password error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// GET PROFILE
async function me(req, res) {
  try {
    const prof = await Professor.findById(req.user.id)
      .select('-password -refreshTokens -resetToken -resetTokenExpire')
      .populate('departments courses');
    if (!prof) return error(res, 'Professor not found', 404);
    success(res, prof);
  } catch (err) {
    console.error('Get profile error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// UPDATE PROFILE
async function updateProfile(req, res) {
  try {
    const allowed = ['name', 'phone', 'title'];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    if (req.file) updates.avatar = `${avatarBasePath}/${req.file.filename}`;

    const prof = await Professor.findById(req.user.id);
    if (!prof) return error(res, 'Professor not found', 404);

    if (updates.avatar && prof.avatar) {
      const oldPath = path.join(process.cwd(), prof.avatar.replace(/^\//, ''));
      if (await fs.pathExists(oldPath)) await fs.unlink(oldPath);
    }

    Object.assign(prof, updates);
    await prof.save();
    success(res, prof, 'Profile updated');
  } catch (err) {
    console.error('Update profile error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// CHANGE PASSWORD
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, 'Both passwords required', 400);

    const prof = await Professor.findById(req.user.id);
    if (!prof) return error(res, 'Professor not found', 404);

    const isMatch = await prof.comparePassword(currentPassword);
    if (!isMatch) return error(res, 'Current password incorrect', 401);

    prof.password = newPassword;
    await prof.clearRefreshTokens();
    await prof.save();

    success(res, null, 'Password changed successfully. Please login again.');
  } catch (err) {
    console.error('Change password error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// SOFT DELETE PROFESSOR
async function removeProfessor(req, res) {
  try {
    const prof = await Professor.findById(req.user.id);
    if (!prof) return error(res, 'Professor not found', 404);

    prof.isDeleted = true;
    await prof.save();
    await Course.updateMany({ professors: prof._id }, { $pull: { professors: prof._id } });

    success(res, null, 'Professor soft-deleted');
  } catch (err) {
    console.error('Remove professor error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// LIST PROFESSORS (admin)
async function listProfessors(req, res) {
  try {
    const { page = 1, limit = 20, search, department } = req.query;
    const q = { isDeleted: { $ne: true } };
    if (department) q.departments = department;
    if (search) q.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Professor.find(q).skip(skip).limit(Number(limit)).populate('departments courses'),
      Professor.countDocuments(q)
    ]);

    success(res, { items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('List professors error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// DASHBOARD
async function dashboard(req, res) {
  try {
    const prof = await Professor.findById(req.user.id)
      .select('-password -refreshTokens -resetToken -resetTokenExpire')
      .populate({
        path: 'courses',
        populate: [
          { path: 'grades.student', select: 'full_name email student_id' },
          { path: 'students', select: 'full_name email student_id' }
        ]
      });
    if (!prof) return error(res, 'Professor not found', 404);

    const coursesWithGrades = (prof.courses || []).map(course => ({
      id: course._id,
      name: course.name,
      code: course.code,
      grades: (course.grades || []).filter(g => g.professor.toString() === prof._id.toString())
    }));

    success(res, { professor: prof, courses: coursesWithGrades });
  } catch (err) {
    console.error('Dashboard error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// ASSIGN COURSES
async function assignCourses(req, res) {
  try {
    const { courseIds } = req.body;
    if (!Array.isArray(courseIds)) return error(res, 'courseIds must be an array', 400);

    const prof = await Professor.findById(req.user.id);
    if (!prof) return error(res, 'Professor not found', 404);

    prof.courses = Array.from(new Set([...(prof.courses || []), ...courseIds]));
    await prof.save();

    await Course.updateMany({ _id: { $in: courseIds } }, { $addToSet: { professors: prof._id } });

    const courses = await Course.find({ _id: { $in: courseIds } });
    await Promise.all(courses.map(c => Student.updateMany({ _id: { $in: c.students } }, { $addToSet: { professors: prof._id } })));

    success(res, { assignedCourses: courseIds }, 'Courses assigned successfully');
  } catch (err) {
    console.error('Assign courses error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// SUBMIT GRADES (by student id)
async function submitGrades(req, res) {
  try {
    const { courseId, grades } = req.body;
    if (!courseId || !Array.isArray(grades)) return error(res, 'Invalid input', 400);

    const course = await Course.findById(courseId);
    if (!course) return error(res, 'Course not found', 404);

    if (!course.professors.includes(req.user.id)) return error(res, 'Not assigned to this course', 403);

    course.grades = grades.map(g => ({ student: g.student, professor: req.user.id, grade: g.grade }));
    await course.save();

    await Promise.all(grades.map(g =>
      Student.findByIdAndUpdate(g.student, { $push: { grades: { course: courseId, grade: g.grade, professor: req.user.id } } })
    ));

    success(res, null, 'Grades submitted successfully');
  } catch (err) {
    console.error('Submit grades error', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// GET STUDENTS IN COURSE
async function getStudentsInCourse(req, res) {
  try {
    const { courseId } = req.body;
    if (!courseId) return error(res, 'courseId is required', 400);

    const course = await Course.findById(courseId).populate('students', 'student_id full_name');
    if (!course) return error(res, 'Course not found', 404);

    if (!course.professors.includes(req.user.id)) return error(res, 'Not assigned to this course', 403);

    success(res, course.students, 'Students retrieved successfully');
  } catch (err) {
    console.error('Get students in course error:', err);
    error(res, 'Server error', 500);
  }
}

// ==============================
// SUBMIT GRADES BY NAME
async function submitGradesByName(req, res) {
  try {
    const { courseId, grades } = req.body;
    if (!courseId) return error(res, 'courseId is required', 400);
    if (!Array.isArray(grades) || grades.length === 0) return error(res, 'grades must be a non-empty array', 400);

    const course = await Course.findById(courseId).populate('students', 'full_name');
    if (!course) return error(res, 'Course not found', 404);
    if (!course.professors.includes(req.user.id)) return error(res, 'Not assigned to this course', 403);

    const studentMap = {};
    course.students.forEach(s => { studentMap[s.full_name] = s._id; });

    const gradeDocs = [];
    const unknownNames = [];
    const missingNameEntries = [];

    await Promise.all(grades.map(async (g, i) => {
      if (!g.name) { missingNameEntries.push({ index: i, message: 'Missing student name' }); return; }
      const studentId = studentMap[g.name];
      if (!studentId) { unknownNames.push(g.name); return; }

      gradeDocs.push({ student: studentId, professor: req.user.id, grade: g.grade });
      await Student.findByIdAndUpdate(studentId, { $push: { grades: { course: courseId, grade: g.grade, professor: req.user.id } } });
    }));

    if (gradeDocs.length > 0) {
      course.grades.push(...gradeDocs);
      await course.save();
    }

    success(res, { submitted: gradeDocs.length, missingNames: missingNameEntries, unknownStudents: unknownNames }, 'Grades processed');
  } catch (err) {
    console.error('Submit grades by name error:', err);
    error(res, 'Server error', 500);
  }
}

module.exports = {
  signup,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  changePassword,
  removeProfessor,
  listProfessors,
  dashboard,
  assignCourses,
  submitGrades,
  getStudentsInCourse,
  submitGradesByName
};
