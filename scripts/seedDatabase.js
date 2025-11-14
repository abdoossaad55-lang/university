const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Department = require('../models/Department');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Professor = require('../models/Professor');
const Assistant = require('../models/Assistant');
const Employee = require('../models/Employee');

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/faculty_management';

async function seedDatabase() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    await mongoose.connection.dropDatabase();
    console.log('🧽 Database cleared');

    const departmentsData = [
      { dept_code: 'CE', dept_name: 'Computer Engineering', office_location: 'Building 1' },
      { dept_code: 'EE', dept_name: 'Electrical Engineering', office_location: 'Building 2' },
      { dept_code: 'ME', dept_name: 'Mechanical Engineering', office_location: 'Building 3' }
    ];
    const departments = await Department.insertMany(departmentsData);

    const coursesData = [
      { code: 'CE101', name: 'Data Structures', credits: 3, department: departments[0]._id },
      { code: 'CE102', name: 'Algorithms', credits: 3, department: departments[0]._id },
      { code: 'EE101', name: 'Circuit Analysis', credits: 3, department: departments[1]._id },
      { code: 'ME101', name: 'Thermodynamics', credits: 3, department: departments[2]._id }
    ];
    const courses = await Course.insertMany(coursesData);

    // Professors
    const professors = [];
    for (let i = 1; i <= 6; i++) {
      professors.push({
        name: `Prof${i} Name`,
        email: `prof${i}@university.edu`,
        phone: `+2010000${100 + i}`,
        title: 'Dr.',
        departments: [departments[i % departments.length]._id],
        courses: [courses[i % courses.length]._id]
      });
    }
    const profDocs = await Professor.insertMany(professors);

    // Assistants
    const assistants = [];
    for (let i = 1; i <= 6; i++) {
      assistants.push({
        name: `Assistant${i} Name`,
        email: `assistant${i}@university.edu`,
        phone: `+2011000${100 + i}`,
        departments: [departments[i % departments.length]._id],
        courses: [courses[i % courses.length]._id]
      });
    }
    const assistantDocs = await Assistant.insertMany(assistants);

    // Employees
    const employees = [];
    const positions = ["Student Affairs", "Registrar", "Finance", "Library"];
    for (let i = 1; i <= 4; i++) {
      employees.push({
        full_name: `Employee${i} Name`,
        email: `employee${i}@university.edu`,
        phone: `+2012000${100 + i}`,
        position: positions[i % positions.length],
        department_id: departments[i % departments.length]._id,
        office_location: `Office ${i}`
      });
    }
    const employeeDocs = await Employee.insertMany(employees);

    // Students
    const salt = await bcrypt.genSalt(10);
    const students = [];
    for (let i = 1; i <= 50; i++) {
      const password = await bcrypt.hash('password123', salt);
      const dept = departments[i % departments.length];
      const student = {
        student_id: `STU${1000 + i}`,
        full_name: `Student${i} Example`,
        email: `student${i}@university.edu`,
        phone: `+2013000${100 + i}`,
        gender: i % 2 === 0 ? 'Male' : 'Female',
        dob: new Date(2000, i % 12, (i % 28) + 1),
        department_id: dept._id,
        address: `City ${i}, Street ${i}`,
        enrollment_status: 'Active',
        password,
        courses: [courses[i % courses.length]._id],
        professors: [profDocs[i % profDocs.length]._id],
        assistants: [assistantDocs[i % assistantDocs.length]._id],
        year: (i % 4) + 1, // years 1..4
        avatar: null
      };
      students.push(student);
    }
    const studentDocs = await Student.insertMany(students);
    console.log(`🎓 Inserted ${studentDocs.length} students`);

    // update departments references
    for (const dept of departments) {
      const deptCourses = courses.filter(c => c.department.toString() === dept._id.toString()).map(c => c._id);
      const deptProfessors = profDocs.filter(p => p.departments.some(d => d.toString() === dept._id.toString())).map(p => p._id);
      const deptAssistants = assistantDocs.filter(a => a.departments.some(d => d.toString() === dept._id.toString())).map(a => a._id);
      const deptStudents = studentDocs.filter(s => s.department_id.toString() === dept._id.toString()).map(s => s._id);

      dept.courses = deptCourses;
      dept.professors = deptProfessors;
      dept.assistants = deptAssistants;
      dept.students = deptStudents;

      await dept.save();
    }

    console.log('🔄 Departments updated with references');
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  }
}

seedDatabase();
