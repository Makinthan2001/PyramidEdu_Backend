const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const studentId = '8485d265-260c-425e-8595-4c26deb363c1';
    console.log(`Querying enrollments for student: ${studentId}`);
    
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      include: {
        subject: { select: { subjectName: true } }
      }
    });

    console.log(JSON.stringify(enrollments, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
