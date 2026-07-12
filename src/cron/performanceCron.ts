import cron from 'node-cron';
import { PerformanceService } from '../modules/performance/service/performance.service';

const performanceService = new PerformanceService();

// Run at midnight every day
// "0 0 * * *" = Minute 0, Hour 0, Every day of the month, Every month, Every day of the week
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Starting daily automated performance calculations...');
  try {
    const results = await performanceService.calculatePerformanceForAll();
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    console.log(`[CRON] Performance calculations complete. Success: ${successCount}, Failed: ${failedCount}`);
  } catch (error) {
    console.error('[CRON] Error running daily performance calculations:', error);
  }
});
