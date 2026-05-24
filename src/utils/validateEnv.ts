export function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_RESET_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      '\nMissing required environment variables:\n' +
      missing.map((key) => `- ${key}`).join('\n') +
      '\n',
    );
    process.exit(1);
  }

  const optional = ['PORT', 'NODE_ENV', 'CORS_ORIGIN', 'JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN', 'JWT_RESET_EXPIRES_IN'];
  const missingOptional = optional.filter((key) => !process.env[key]);

  if (missingOptional.length > 0) {
    console.warn(`Optional env vars not set: ${missingOptional.join(', ')}`);
  }
}

export default validateEnv;
