const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");

router.get("/", async (req, res) => {
    try {
        const employees = await Employee.find().populate("department_id", "dept_name");
        res.json(employees);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.status(201).json({ message: "Employee added", emp });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        });
        res.json({ message: "Employee updated", emp });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        res.json({ message: "Employee deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
