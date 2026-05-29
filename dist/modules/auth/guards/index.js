"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.managerOrAdmin = exports.adminOnly = exports.roleGuard = exports.default = exports.jwtGuard = void 0;
var jwt_guard_1 = require("./jwt.guard");
Object.defineProperty(exports, "jwtGuard", { enumerable: true, get: function () { return jwt_guard_1.jwtGuard; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(jwt_guard_1).default; } });
var role_guard_1 = require("./role.guard");
Object.defineProperty(exports, "roleGuard", { enumerable: true, get: function () { return role_guard_1.roleGuard; } });
Object.defineProperty(exports, "adminOnly", { enumerable: true, get: function () { return role_guard_1.adminOnly; } });
Object.defineProperty(exports, "managerOrAdmin", { enumerable: true, get: function () { return role_guard_1.managerOrAdmin; } });
