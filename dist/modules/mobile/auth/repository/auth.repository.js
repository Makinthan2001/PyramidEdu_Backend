"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileAuthRepository = void 0;
const prisma_config_1 = __importDefault(require("../../../../config/prisma.config"));
exports.MobileAuthRepository = {
    findStudentByEmail(email) {
        return prisma_config_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { student: true },
        });
    },
    findStudentById(userId) {
        return prisma_config_1.default.user.findUnique({
            where: { id: userId },
            include: { student: true },
        });
    },
    findRefreshTokenByToken(token) {
        return prisma_config_1.default.refreshToken.findUnique({ where: { token } });
    },
    createRefreshToken(data) {
        return prisma_config_1.default.refreshToken.create({ data });
    },
    deleteRefreshTokenByToken(token) {
        return prisma_config_1.default.refreshToken.delete({ where: { token } });
    },
    deleteRefreshTokensByUserId(userId) {
        return prisma_config_1.default.refreshToken.deleteMany({ where: { userId } });
    },
};
exports.default = exports.MobileAuthRepository;
