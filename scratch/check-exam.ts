import prisma from '../src/config/prisma.config';

async function run() {
  const exam = await prisma.exam.findUnique({
    where: { id: '7e30e2e4-1046-4de5-b1c3-e110efb31d86' }
  });
  console.log("Exam details from DB:", exam);
}

run();
