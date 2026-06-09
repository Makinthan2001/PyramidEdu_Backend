"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const serverless_1 = require("@neondatabase/serverless");
const adapter_neon_1 = require("@prisma/adapter-neon");
const client_1 = require("@prisma/client");
const ws_1 = __importDefault(require("ws"));
// Set the WebSocket constructor for the serverless driver to work on Node.js
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
const connectionString = `${process.env.DATABASE_URL}`;
const globalForPrisma = global;
if (!globalForPrisma.prisma) {
    const adapter = new adapter_neon_1.PrismaNeon({ connectionString });
    globalForPrisma.prisma = new client_1.PrismaClient({
        adapter,
        log: ["error", "warn"],
    });
}
exports.prisma = globalForPrisma.prisma;
exports.default = exports.prisma;
