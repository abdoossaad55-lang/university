// src/models/Notification.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, refPath: "userModel" },
    userModel: { type: String, enum: ["Student", "Professor", "Admin"], default: "Student" },

    title: String,
    message: String,
    seen: { type: Boolean, default: false },

    // Admin fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // Who created this notification
    type: { type: String, enum: ["individual", "global"], default: "individual" },
    status: { type: String, enum: ["pending", "sent"], default: "sent" },
    scheduledAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);
