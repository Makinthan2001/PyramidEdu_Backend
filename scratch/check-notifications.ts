import prisma from '../src/config/prisma.config';

async function check() {
  try {
    console.log("Checking notifications table...");
    const notifications = await prisma.notification.findMany({
      take: 5,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });
    console.log("Notifications successfully queried:", notifications);
  } catch (e) {
    console.error("Prisma error querying notifications:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
