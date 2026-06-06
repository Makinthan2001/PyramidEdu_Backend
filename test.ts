import prisma from './src/config/prisma.config';
async function run() {
  const result = await prisma.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_name = \'enrollments\';');
  console.log(result);
}
run();
