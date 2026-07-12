import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

if (!globalForPrisma.prisma) {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma;
export default prisma;
