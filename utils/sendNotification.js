const Notification = require("../models/Notification");

async function sendNotification(userId, userModel, title, message) {
    try {
        await Notification.create({ user: userId, userModel, title, message });
    } catch (err) {
        console.error("Failed to send notification:", err);
    }
}

module.exports = sendNotification;
