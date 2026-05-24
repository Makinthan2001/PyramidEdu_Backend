// ============================================================
// src/utils/validateEnv.ts  (updated)
// Validates required environment variables before server starts.
// ============================================================

export function validateEnv(): void {
  const required: string[] = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_RESET_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      '\n❌  Missing required environment variables:\n' +
      missing.map((k) => `    - ${k}`).join('\n') +
      '\n\nPlease add them to your .env file and restart the server.\n',
    );
    process.exit(1);
  }

  const recommended: string[] = [
    'PORT', 'NODE_ENV', 'CORS_ORIGIN',
    'JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN',
  ];

  const missingOptional = recommended.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(
      '⚠️   Optional env vars not set (defaults will be used):\n' +
      missingOptional.map((k) => `    - ${k}`).join('\n'),
    );
  }

  console.log('✅  Environment variables validated.');
}

export default validateEnv;
