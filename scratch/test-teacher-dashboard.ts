import prisma from '../src/config/prisma.config';
import { Prisma, EnrollmentStatus, ApprovalStatus } from '@prisma/client';

async function test() {
  try {
    // Find first teacher user
    const teacherUser = await prisma.user.findFirst({
      where: { role: 'TEACHER' },
    });

    if (!teacherUser) {
      console.log('No teacher users found in database.');
      return;
    }

    console.log(`Found teacher user: ${teacherUser.email} (ID: ${teacherUser.id})`);

    // Emulate the service logic of getMyDashboardData to run a query sanity check
    const teacher = await prisma.teacher.findFirst({
      where: { userId: teacherUser.id, deletedAt: null },
      include: {
        subjectAllocations: {
          where: { status: 'ACTIVE' },
          include: {
            batches: true,
          },
        },
      },
    });

    if (!teacher) {
      console.log('No teacher profile found.');
      return;
    }

    console.log(`Teacher ID: ${teacher.id}`);
    
    // Check subject allocations and batches
    console.log('Subject allocations count:', teacher.subjectAllocations.length);
    for (const sa of teacher.subjectAllocations) {
      console.log(`- Subject ID: ${sa.subjectId}, Batches: ${sa.batches.map(b => b.batchName).join(', ')}`);
    }

    const orConditions: Prisma.StudentWhereInput[] = [];
    orConditions.push({
      enrollments: {
        some: {
          teacherId: teacher.id,
          enrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      },
    });

    for (const alloc of teacher.subjectAllocations) {
      const batchIds = alloc.batches.map((b) => b.id);
      if (batchIds.length > 0) {
        orConditions.push({
          batchId: { in: batchIds },
          enrollments: {
            some: {
              subjectId: alloc.subjectId,
              enrollmentStatus: EnrollmentStatus.ACTIVE,
            },
          },
        });
      }
    }

    const assignedStudentsWhere: Prisma.StudentWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      OR: orConditions,
    };

    const totalStudents = await prisma.student.count({
      where: assignedStudentsWhere,
    });
    console.log('Assigned students count:', totalStudents);

    // Today's attendance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendances = await prisma.attendance.findMany({
      where: {
        OR: [
          { teacherId: teacher.id },
          { student: assignedStudentsWhere },
        ],
        attendanceDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        attendanceStatus: true,
      },
    });
    console.log("Today's attendances found:", todayAttendances.length);

    // Class average
    const averageMarksAgg = await prisma.result.aggregate({
      where: {
        teacherId: teacher.id,
      },
      _avg: {
        marks: true,
      },
    });
    console.log("Average Marks Aggregate result:", averageMarksAgg);

    console.log('Database sanity checks completed successfully!');
  } catch (error) {
    console.error('Error during dashboard queries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
