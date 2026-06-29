import cron from 'node-cron';
import { ParentReportsService } from '../modules/parent-reports/service/parent-reports.service';
import prisma from '../config/prisma.config';

// Schedule to run every day at 11:50 PM to detect the final day of the month
// Cron expression: 50 23 * * *
cron.schedule('50 23 * * *', async () => {
  const today = new Date();
  
  // Detect if today is the final day of the month
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getMonth() !== today.getMonth();
  
  if (!isLastDayOfMonth) {
    console.log(`[Cron] Today (${today.toLocaleDateString()}) is not the last day of the month. Skipping parent reports generation.`);
    return;
  }
  
  console.log(`[Cron] Last day of the month detected (${today.toLocaleDateString()}). Starting automated parent reports generation...`);
  
  try {
    const targetMonth = today.getMonth() + 1; // 1-12
    const targetYear = today.getFullYear();
    
    // Check if reports for this month and year have already been generated
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    
    const existingCount = await prisma.parentReport.count({
      where: {
        generatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (existingCount > 0) {
      console.log(`[Cron] Reports for ${targetMonth}/${targetYear} already generated. Skipping to prevent duplicates.`);
      return;
    }

    console.log(`[Cron] Generating automatic reports for month: ${targetMonth}, year: ${targetYear}`);
    const results = await ParentReportsService.generateMonthlyReports(targetMonth, targetYear, 'AUTOMATIC');
    
    const successful = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[Cron] Automatic reports generation finished. Success: ${successful}, Skipped: ${skipped}, Failed: ${failed}`);
  } catch (error) {
    console.error('[Cron] Automatic reports generation encountered an error:', error);
  }
});

console.log('[Cron] Automated Parent Reports Cron Job Registered successfully (Runs daily at 11:50 PM to detect last day of the month).');
