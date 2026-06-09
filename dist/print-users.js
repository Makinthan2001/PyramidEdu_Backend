"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_config_1 = __importDefault(require("./config/prisma.config"));
const password_util_1 = require("./utils/password.util");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const hashedPassword = yield (0, password_util_1.hashPassword)("Admin@123");
        yield prisma_config_1.default.user.update({
            where: { email: "admin@gmail.com" },
            data: { password: hashedPassword },
        });
        console.log("Successfully set password for admin@gmail.com to Admin@123");
    });
}
main()
    .catch(console.error)
    .finally(() => prisma_config_1.default.$disconnect());
