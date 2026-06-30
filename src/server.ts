import app from './app';
import { notificationService } from './modules/notification/service/notification.service';
import { notificationCronService } from './modules/mobile/notification/notification-cron.service';
import './cron/parentReportsCron';


const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  
  // Initialize Cron Jobs
  notificationCronService; // The constructor calls init()
});

const shutdown = (reason: string) => {
  console.log(`Shutting down server: ${reason}`);
  server.close((err) => {
    if (err) {
      console.error('Error closing server', err);
      process.exit(1);
    }

    // try to disconnect Prisma if available
    import('./config/prisma.config')
      .then(({ prisma }) => prisma.$disconnect())
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});