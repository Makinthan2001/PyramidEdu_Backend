import prisma from './config/prisma.config';
import { hashPassword } from './utils/password.util';

async function main() {
  const hashedPassword = await hashPassword("Admin@123");
  await prisma.user.update({
    where: { email: "admin@gmail.com" },
    data: { password: hashedPassword },
  });
  console.log("Successfully set password for admin@gmail.com to Admin@123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
