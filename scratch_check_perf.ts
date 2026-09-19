import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/config/prisma.config';

async function check() {
  const students = await prisma.student.findMany({
    include: {
      user: true,
      performancePredictions: {
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });

  for (const s of students) {
    console.log('====================================');
    console.log(`Student: ${s.user.fullName} (${s.indexNumber})`);
    console.log(`Student Table status: ${s.performanceStatus} | trend: ${s.trendStatus}`);
    s.performancePredictions.forEach((p, idx) => {
      console.log(`  Prediction #${idx + 1}: Final: ${p.finalScore} | Level: ${p.performanceLevel} | Trend: ${p.trendStatus} | Att: ${p.attendanceScore} | MCQ: ${p.mcqScore} | Essay: ${p.essayScore} | Manual: ${p.manualExamScore}`);
      console.log(`    Recommendations: ${JSON.stringify(p.recommendations)}`);
    });
  }
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
