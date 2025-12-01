const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

const studentAuth = require("../middlewares/studentAuth");
const professorAuth = require("../middlewares/professorAuth");

// Unified auth: allow student OR professor
const userAuth = async (req, res, next) => {
    try {
        await professorAuth(req, res, async () => {
            req.userRole = "Professor";
            next();
        });
    } catch {
        await studentAuth(req, res, async () => {
            req.userRole = "Student";
            next();
        });
    }
};

// ------------------------------
// GET NOTIFICATIONS
// ------------------------------
router.post("/list", userAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 });

        res.json({ success: true, message: "Notifications fetched", data: notifications });
    } catch (err) {
        console.error("Fetch notifications error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ------------------------------
// MARK NOTIFICATION AS READ
// ------------------------------
router.post("/read", userAuth, async (req, res) => {
    try {
        const { notificationId } = req.body;
        if (!notificationId) return res.status(400).json({ success: false, message: "notificationId is required" });

        await Notification.findByIdAndUpdate(notificationId, { seen: true });

        res.json({ success: true, message: "Notification marked as read" });
    } catch (err) {
        console.error("Mark notification read error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
