export function validateEnv() {
  const required = ['DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`Missing required env vars: ${missing.join(', ')}. Application may not work correctly.`);
  }
}

export default validateEnv;
