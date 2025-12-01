const express = require("express");
const router = express.Router();
const adminAuth = require("../middlewares/adminAuth");
const adminController = require("../controllers/adminController");


// -----------------
// ADMIN AUTH
// -----------------
router.post("/signup", adminController.signup);
router.post("/login", adminController.login);

// -----------------
// STUDENTS
// -----------------
router.get("/students", adminAuth, adminController.listStudents);
router.get("/students/:id", adminAuth, adminController.getStudent);
router.put("/students/:id", adminAuth, adminController.updateStudent);
router.delete("/students/:id", adminAuth, adminController.deleteStudent);
router.patch("/students/:id/status", adminAuth, adminController.toggleStudentStatus);

// -----------------
// PROFESSORS
// -----------------
router.get("/professors", adminAuth, adminController.listProfessors);
router.get("/professors/:id", adminAuth, adminController.getProfessor);
router.put("/professors/:id", adminAuth, adminController.updateProfessor);
router.delete("/professors/:id", adminAuth, adminController.deleteProfessor);
router.patch("/professors/:id/status", adminAuth, adminController.toggleProfessorStatus);

// -----------------
// COURSES
// -----------------
router.get("/courses", adminAuth, adminController.listCourses);
router.get("/courses/:id", adminAuth, adminController.getCourse);
router.post("/courses", adminAuth, adminController.createCourse);
router.put("/courses/:id", adminAuth, adminController.updateCourse);
router.delete("/courses/:id", adminAuth, adminController.deleteCourse);
router.patch("/courses/:id/assign-professors", adminAuth, adminController.assignProfessorsToCourse);
router.patch("/courses/:id/enroll-students", adminAuth, adminController.enrollStudentsToCourse);

// -----------------
// ASSIGNMENTS
// -----------------
router.get("/assignments", adminAuth, adminController.listAllAssignments);
router.patch("/assignments/:id/submissions/:submissionId/grade", adminAuth, adminController.overrideAssignmentGrade);

// -----------------
// LECTURE SLIDES
// -----------------
router.get("/slides", adminAuth, adminController.listAllSlides);
router.delete("/slides/:id", adminAuth, adminController.deleteSlide);

// -----------------
// NOTIFICATIONS
// -----------------
router.post("/notifications", adminAuth, adminController.sendNotification);
router.get("/notifications", adminAuth, adminController.listNotifications);

// -----------------
// SEMESTERS
// -----------------
router.get("/semesters", adminAuth, adminController.listSemesters);
router.post("/semesters", adminAuth, adminController.createSemester);
router.put("/semesters/:id", adminAuth, adminController.updateSemester);

// Send system-wide announcement
router.post("/notifications/global", adminAuth, adminController.sendGlobalNotification);

// Schedule a notification
router.post("/notifications/schedule", adminAuth, adminController.scheduleNotification);

// View notification delivery status
router.get("/notifications/:id/status", adminAuth, adminController.getNotificationStatus);


module.exports = router;
