"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeachersService = void 0;
const teachers_routes_1 = __importDefault(require("./routes/teachers.routes"));
const teachers_service_1 = __importDefault(require("./service/teachers.service"));
exports.TeachersService = teachers_service_1.default;
exports.default = teachers_routes_1.default;
