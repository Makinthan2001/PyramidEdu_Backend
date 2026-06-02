"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectsService = void 0;
const subjects_routes_1 = __importDefault(require("./routes/subjects.routes"));
var subjects_service_1 = require("./service/subjects.service");
Object.defineProperty(exports, "SubjectsService", { enumerable: true, get: function () { return subjects_service_1.SubjectsService; } });
exports.default = subjects_routes_1.default;
