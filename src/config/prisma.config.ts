import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Set the WebSocket constructor for the serverless driver to work on Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (process.env.NODE_ENV === "production") {
  const adapter = new PrismaNeon({ connectionString });
  prismaInstance = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
} else {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaNeon({ connectionString });
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: ["error", "warn"],
    });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;
export default prisma;

