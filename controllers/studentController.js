// src/controllers/studentController.js
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const Joi = require('joi');

const Student = require('../models/Student');
const Course = require('../models/Course');

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/token');

const { success, error } = require('../utils/response');
const sendEmail = require('../utils/sendEmail');

// ==============================
const avatarBasePath = `/uploads/students`;

// ==============================
// Generate Unique Student ID
function createStudentId(full_name) {
  const prefix = (full_name.replace(/\s+/g, '').substring(0, 3) || 'STD').toUpperCase();
  const random = Math.floor(Math.random() * 9000) + 1000;
  const hash = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}${random}${hash}`;
}

// ==============================
// VALIDATION SCHEMAS
const signupSchema = Joi.object({
  full_name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirm_password: Joi.any().valid(Joi.ref('password')).required(),
  department_id: Joi.string().allow(null, ''),
  year: Joi.number().min(1).max(5).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ==========================================================
// SIGNUP
async function signup(req, res) {
  try {
    const body = req.body;
    const { error: vErr } = signupSchema.validate(body);
    if (vErr) return error(res, vErr.details[0].message, 400);

    const exist = await Student.findOne({ email: body.email.toLowerCase() });
    if (exist) return error(res, "Email already exists", 400);

    const student_id = createStudentId(body.full_name);

    const student = new Student({
      full_name: body.full_name,
      email: body.email.toLowerCase(),
      password: body.password,
      student_id,
      department_id: body.department_id || null,
      year: body.year || 1,
      avatar: req.file ? `${avatarBasePath}/${req.file.filename}` : null
    });

    await student.save();

    // Use the full mongoose document so the token util can pick _id or id and role
    const accessToken = generateAccessToken(student);
    const refreshToken = generateRefreshToken(student);

    await student.addRefreshToken(refreshToken);

    // Return sanitized payload
    success(res, {
      student: {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email,
        avatar: student.avatar,
        year: student.year,
        department_id: student.department_id
      },
      tokens: { accessToken, refreshToken }
    }, "Account created successfully");

  } catch (err) {
    console.error('Signup error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// LOGIN
async function login(req, res) {
  try {
    const { error: vErr } = loginSchema.validate(req.body);
    if (vErr) return error(res, vErr.details[0].message, 400);

    const student = await Student.findOne({ email: req.body.email.toLowerCase() })
      .populate("courses")
      .populate("professors")
      .populate("assistants")
      .populate("department_id"); // populate department info if needed

    if (!student) return error(res, "Invalid email or password", 401);

    if (student.lockedUntil && Date.now() < student.lockedUntil)
      return error(res, "Account locked - try again later", 403);

    const match = await student.comparePassword(req.body.password);
    if (!match) {
      student.loginAttempts = (student.loginAttempts || 0) + 1;
      if (student.loginAttempts >= 5) {
        student.lockedUntil = Date.now() + 15 * 60 * 1000;
        student.loginAttempts = 0;
      }
      await student.save();
      return error(res, "Invalid email or password", 401);
    }

    student.loginAttempts = 0;
    student.lockedUntil = null;
    await student.save();

    const token = generateAccessToken(student);

    // 🔥 Build final formatted response
    const formattedStudent = {
      id:          student.id,
      full_name:   student.full_name,
      email:       student.email,
      student_id:  student.student_id,
      enrollment_status: student.enrollment_status ?? "Active", // if exists in schema
      courses:     student.courses?.map(c => c._id),
      professors:  student.professors?.map(p => p._id),
      assistants:  student.assistants?.map(a => a._id),
      department:  student.department_id?._id ?? student.department_id,
      year:        student.year,
      avatar:      student.avatar
    };

    return res.status(200).json({
      message: "Login successful",
      student: formattedStudent,
      token: token
    });

  } catch (err) {
    console.error("Login error:", err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// REFRESH TOKEN
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, "refreshToken required", 400);

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      // token invalid or expired
      return error(res, "Invalid or expired refresh token", 401);
    }

    const student = await Student.findById(payload.id);
    if (!student) return error(res, "User not found", 404);

    if (!student.refreshTokens.some(t => t.token === refreshToken))
      return error(res, "Token not recognized", 401);

    const newAccess = generateAccessToken(student);
    const newRefresh = generateRefreshToken(student);

    await student.removeRefreshToken(refreshToken);
    await student.addRefreshToken(newRefresh);

    success(res, { accessToken: newAccess, refreshToken: newRefresh });

  } catch (err) {
    console.error('Refresh token error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// LOGOUT
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!req.user || !req.user.id) return error(res, "Unauthorized", 401);

    const student = await Student.findById(req.user.id);
    if (!student) return error(res, "User not found", 404);

    if (refreshToken) await student.removeRefreshToken(refreshToken);
    else await student.clearRefreshTokens();

    success(res, null, "Logged out successfully");
  } catch (err) {
    console.error('Logout error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// FORGOT PASSWORD
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return error(res, "Email required", 400);

    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student) return error(res, "No account found", 404);

    const token = crypto.randomBytes(20).toString('hex');
    student.resetToken = token;
    student.resetTokenExpire = Date.now() + 3600000; // 1 hour
    await student.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    // use safe templating for email (sendEmail expected to handle HTML)
    await sendEmail(student.email, "Password Reset", `<p>Reset link: <a href="${resetURL}">${resetURL}</a></p>`);

    success(res, null, "Reset email sent");

  } catch (err) {
    console.error('Forgot password error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// RESET PASSWORD
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return error(res, "token and password required", 400);

    const student = await Student.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() }
    });

    if (!student) return error(res, "Invalid/Expired token", 400);

    student.password = password;
    student.resetToken = undefined;
    student.resetTokenExpire = undefined;

    // Clear refresh tokens (await)
    await student.clearRefreshTokens();

    await student.save();

    success(res, null, "Password updated");

  } catch (err) {
    console.error('Reset password error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// MY PROFILE
async function me(req, res) {
  try {
    if (!req.user || !req.user.id) return error(res, "Unauthorized", 401);

    const student = await Student.findById(req.user.id)
      .select('-password -refreshTokens')
      .populate('department_id', 'dept_name dept_code')
      .populate({ path: 'courses', populate: ['professors', 'assistants', 'department'] });

    if (!student) return error(res, "Not found", 404);

    success(res, student);
  } catch (err) {
    console.error('Me error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// UPDATE PROFILE
async function updateProfile(req, res) {
  try {
    if (!req.user || !req.user.id) return error(res, "Unauthorized", 401);

    const allowed = ['full_name', 'phone', 'address', 'year'];
    const updates = {};

    allowed.forEach(key => {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    });

    if (req.file) updates.avatar = `${avatarBasePath}/${req.file.filename}`;

    const student = await Student.findById(req.user.id);
    if (!student) return error(res, "Not found", 404);

    // If avatar replaced, delete old file (safe await)
    if (updates.avatar && student.avatar) {
      try {
        const oldFile = path.join(process.cwd(), student.avatar.replace(/^\//, ''));
        const exists = await fs.pathExists(oldFile);
        if (exists) await fs.unlink(oldFile);
      } catch (e) {
        // Log and continue (non-fatal)
        console.warn('Failed to delete old avatar:', e);
      }
    }

    Object.assign(student, updates);
    await student.save();

    // return sanitized
    const safeStudent = {
      id: student.id,
      student_id: student.student_id,
      full_name: student.full_name,
      email: student.email,
      avatar: student.avatar,
      year: student.year,
      department_id: student.department_id
    };

    success(res, safeStudent, "Updated successfully");

  } catch (err) {
    console.error('Update profile error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// CHANGE PASSWORD
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, "currentPassword and newPassword required", 400);
    if (!req.user || !req.user.id) return error(res, "Unauthorized", 401);

    const student = await Student.findById(req.user.id);
    if (!student) return error(res, "User not found", 404);

    const ok = await student.comparePassword(currentPassword);
    if (!ok) return error(res, "Wrong current password", 401);

    student.password = newPassword;
    await student.clearRefreshTokens();
    await student.save();

    success(res, null, "Password changed. Login again");

  } catch (err) {
    console.error('Change password error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// DELETE (SOFT)
async function removeStudent(req, res) {
  try {
    const stud = await Student.findById(req.params.id);
    if (!stud) return error(res, "Not found", 404);

    stud.isDeleted = true;
    await stud.save();

    // Remove student from courses
    await Course.updateMany({ students: stud._id }, { $pull: { students: stud._id } });

    success(res, null, "Student soft deleted");
  } catch (err) {
    console.error('Remove student error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// LIST STUDENTS
async function listStudents(req, res) {
  try {
    const { page = 1, limit = 20, search, department, year } = req.query;
    const q = { isDeleted: false };

    if (department) q.department_id = department;
    if (year) q.year = Number(year);

    if (search) {
      const re = new RegExp(search, 'i');
      q.$or = [{ full_name: re }, { email: re }, { student_id: re }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const students = await Student.find(q).skip(skip).limit(Number(limit)).select('-password -refreshTokens');
    const total = await Student.countDocuments(q);

    success(res, { students, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });

  } catch (err) {
    console.error('List students error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// ENROLL COURSE
async function enrollCourse(req, res) {
  try {
    const { courseId } = req.body;
    if (!courseId) return error(res, "courseId required", 400);

    const student = await Student.findById(req.user.id);
    const course = await Course.findById(courseId);

    if (!student || !course) return error(res, "Not found", 404);

    if (student.courses.includes(courseId)) return error(res, "Already enrolled", 400);

    student.courses.push(courseId);
    course.students.push(student._id);

    await student.save();
    await course.save();

    // return updated safe student
    const safeStudent = await Student.findById(student._id).select('-password -refreshTokens');
    success(res, safeStudent, "Enrolled successfully");
  } catch (err) {
    console.error('Enroll course error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// REMOVE COURSE
async function removeCourse(req, res) {
  try {
    const { courseId } = req.body;
    if (!courseId) return error(res, "courseId required", 400);

    const student = await Student.findById(req.user.id);
    const course = await Course.findById(courseId);

    if (!student || !course) return error(res, "Not found", 404);

    student.courses.pull(courseId);
    course.students.pull(student._id);

    await student.save();
    await course.save();

    const safeStudent = await Student.findById(student._id).select('-password -refreshTokens');
    success(res, safeStudent, "Course removed");
  } catch (err) {
    console.error('Remove course error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// GET GRADES
async function getGrades(req, res) {
  try {
    const student = await Student.findById(req.user.id)
      .populate({ path: "courses", select: "name code grades credits" });

    if (!student) return error(res, "Not found", 404);

    const grades = student.courses.map(c => ({
      course: { name: c.name, code: c.code },
      grades: (c.grades || []).filter(g => g.student.toString() === student.id)
    }));

    success(res, grades);
  } catch (err) {
    console.error('Get grades error:', err);
    return error(res, "Server Error", 500);
  }
}

// ==========================================================
// DASHBOARD
async function dashboard(req, res) {
  try {
    const student = await Student.findById(req.user.id)
      .populate("department_id", "dept_name dept_code")
      .populate({ path: "courses", populate: ["professors", "assistants", "department"] });

    if (!student) return error(res, "Not found", 404);

    success(res, {
      student,
      courses: student.courses
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return error(res, "Server Error", 500);
  }
}

// EXPORT CONTROLLER
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
  removeStudent,
  listStudents,
  enrollCourse,
  removeCourse,
  getGrades,
  dashboard
};
