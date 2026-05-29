"use strict";
/**
 * Users Validators - Barrel re-exports all user validation schemas
 * Individual schemas are defined in dto/ folder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createAdminSchema = exports.createStudentSchema = exports.createSupportStaffSchema = exports.createTeacherSchema = exports.createManagerSchema = void 0;
var dto_1 = require("../dto");
Object.defineProperty(exports, "createManagerSchema", { enumerable: true, get: function () { return dto_1.createManagerSchema; } });
Object.defineProperty(exports, "createTeacherSchema", { enumerable: true, get: function () { return dto_1.createTeacherSchema; } });
Object.defineProperty(exports, "createSupportStaffSchema", { enumerable: true, get: function () { return dto_1.createSupportStaffSchema; } });
Object.defineProperty(exports, "createStudentSchema", { enumerable: true, get: function () { return dto_1.createStudentSchema; } });
Object.defineProperty(exports, "createAdminSchema", { enumerable: true, get: function () { return dto_1.createAdminSchema; } });
Object.defineProperty(exports, "updateUserSchema", { enumerable: true, get: function () { return dto_1.updateUserSchema; } });
exports.default = {};
