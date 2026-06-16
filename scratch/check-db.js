const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const exams = await prisma.exam.findMany({
      where: { examType: 'ESSAY' }
    });
    console.log("Essay Exams:", exams.map(e => ({ id: e.id, title: e.title })));

    const submissions = await prisma.examSubmission.findMany({
      where: { exam: { examType: 'ESSAY' } },
      include: { exam: true, student: true }
    });
    console.log("Submissions:");
    submissions.forEach(s => {
      console.log(`- ID: ${s.id}, Exam: ${s.exam.title}, Student: ${s.student.userId}, answerPdfUrl: ${s.answerPdfUrl}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
