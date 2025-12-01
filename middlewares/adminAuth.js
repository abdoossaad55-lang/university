const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin"); // your admin model

module.exports = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);
        if (!admin) return res.status(401).json({ success: false, message: "Admin not found" });

        req.user = admin;
        next();
    } catch (err) {
        console.error("Admin auth error:", err);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};
