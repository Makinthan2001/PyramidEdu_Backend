const { PrismaClient } = require('@prisma/client');
const { AttendanceService } = require('./src/modules/attendance/service/attendance.service');

async function test() {
  try {
    const studentId = "815c327d-9c07-4e34-b0d1-96a702fef47b"; // From previous error log
    const filters = { fromDate: "2026-06-08" };
    console.log("Testing with filters:", filters);
    
    // We mock the DB call if it's too complex or just run it
    const res = await AttendanceService.getManagerStudentDetails(studentId, filters);
    console.log("Success! Attendances count:", res.attendances.length);
  } catch (error) {
    console.error("Test Failed!");
    console.error(error);
  }
}

test();
