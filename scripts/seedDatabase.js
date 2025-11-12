const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Department = require('../models/Department');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Assistant = require('../models/Assistant');
const Employee = require('../models/Employee');
const Student = require('../models/Student');

const uri = 'mongodb://127.0.0.1:27017/faculty_management';

async function seedDatabase() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        // Clear collections
        await Promise.all([
            Department.deleteMany({}),
            Course.deleteMany({}),
            Professor.deleteMany({}),
            Assistant.deleteMany({}),
            Employee.deleteMany({}),
            Student.deleteMany({})
        ]);
        console.log('🧽 Database cleared');

        // --- Departments ---
        const departmentsData = [
            { dept_code: 'CE', dept_name: 'Computer Engineering', office_location: 'Building 1' },
            { dept_code: 'EE', dept_name: 'Electrical Engineering', office_location: 'Building 2' },
            { dept_code: 'ME', dept_name: 'Mechanical Engineering', office_location: 'Building 3' },
        ];

        const departments = await Department.insertMany(departmentsData);
        console.log('🏢 Departments created');

        // --- Courses ---
        const coursesData = [];
        for (let i = 1; i <= 10; i++) {
            const dept = departments[i % departments.length];
            coursesData.push({
                code: `C${100 + i}`,
                name: `Course ${i}`,
                description: `Description for Course ${i}`,
                credits: 3,
                department: dept._id
            });
        }
        const courses = await Course.insertMany(coursesData);
        console.log('📚 Courses created');

        // --- Professors ---
        const professorsData = [];
        for (let i = 1; i <= 20; i++) {
            const dept = departments[i % departments.length];
            const profCourses = courses.filter((_, idx) => idx % 20 === i % 20).map(c => c._id);
            professorsData.push({
                name: `Professor ${i}`,
                email: `prof${i}@university.edu`,
                phone: `+201000000${(100 + i).toString().slice(-3)}`,
                title: i % 3 === 0 ? 'Dr.' : i % 3 === 1 ? 'Prof.' : 'Eng.',
                departments: [dept._id],
                courses: profCourses
            });
        }
        const professors = await Professor.insertMany(professorsData);
        console.log('👩‍🏫 Professors created');

        // --- Assistants ---
        const assistantsData = [];
        for (let i = 1; i <= 20; i++) {
            const dept = departments[i % departments.length];
            const assistantCourses = courses.filter((_, idx) => idx % 20 === i % 20).map(c => c._id);
            assistantsData.push({
                name: `Assistant ${i}`,
                email: `assistant${i}@university.edu`,
                phone: `+201000100${(100 + i).toString().slice(-3)}`,
                departments: [dept._id],
                courses: assistantCourses
            });
        }
        const assistants = await Assistant.insertMany(assistantsData);
        console.log('🧑‍💻 Assistants created');

        // --- Employees ---
        const employeesData = [];
        for (let i = 1; i <= 5; i++) {
            const dept = departments[i % departments.length];
            employeesData.push({
                full_name: `Employee ${i}`,
                email: `employee${i}@university.edu`,
                phone: `+201000200${(100 + i).toString().slice(-3)}`,
                position: 'Student Affairs',
                department_id: dept._id,
                office_location: `Office ${i}`
            });
        }
        const employees = await Employee.insertMany(employeesData);
        console.log('💼 Employees created');

        // --- Students ---
        const studentsData = [];
        const salt = await bcrypt.genSalt(10);
        for (let i = 1; i <= 100; i++) {
            const dept = departments[i % departments.length];
            const hashedPassword = await bcrypt.hash(`password${i}`, salt);
            studentsData.push({
                student_id: `STU${1000 + i}`,
                full_name: `Student ${i}`,
                email: `student${i}@university.edu`,
                phone: `+201000300${(100 + i).toString().slice(-3)}`,
                gender: i % 2 === 0 ? 'Male' : 'Female',
                dob: new Date(2000, i % 12, i % 28 + 1),
                department_id: dept._id,
                address: `City ${i}, Street ${i}`,
                enrollment_status: 'Active',
                password: hashedPassword,
                confirm_password: hashedPassword,
                courses: courses.slice(0, 5).map(c => c._id), // enroll first 5 courses
                professors: professors.slice(0, 5).map(p => p._id),
                assistants: assistants.slice(0, 5).map(a => a._id)
            });
        }
        await Student.insertMany(studentsData);
        console.log('🎓 Students created');

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        console.log('🎉 Seeding completed successfully');
    } catch (err) {
        console.error('❌ Error during seeding:', err);
        process.exit(1);
    }
}

seedDatabase();
