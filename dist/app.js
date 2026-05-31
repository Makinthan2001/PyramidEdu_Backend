"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const errorHandler_1 = __importDefault(require("./middleware/errorHandler"));
const validateEnv_1 = require("./utils/validateEnv");
const auth_1 = __importDefault(require("./modules/auth"));
const health_1 = __importDefault(require("./modules/health"));
const mobile_1 = __importDefault(require("./modules/mobile"));
const users_1 = __importDefault(require("./modules/users"));
const subjects_1 = __importDefault(require("./modules/subjects"));
const subjectsController = __importStar(require("./modules/subjects/controller/subjects.controller"));
(0, validateEnv_1.validateEnv)();
const app = (0, express_1.default)();
// Secure security headers
app.use((0, helmet_1.default)());
const defaultCorsOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
];
const corsOrigin = Array.from(new Set([
    ...defaultCorsOrigins,
    ...(process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
        : []),
]));
const corsOptions = {
    origin: corsOrigin,
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use((0, cors_1.default)(corsOptions));
app.options(/.*/, (0, cors_1.default)(corsOptions));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Rate limiting for auth routes
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skip: (req) => req.method === 'OPTIONS',
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});
const authBasePaths = ['/api/v1/auth', '/api/auth'];
// Apply rate limiter to auth routes
app.use(['/api/v1/auth/login', '/api/auth/login', '/api/v1/mobile/auth/login'], authRateLimiter);
app.use(['/api/v1/auth/register', '/api/auth/register'], authRateLimiter);
app.get('/', (req, res) => {
    res.send('PyramidEdu Backend Running');
});
// Health check routes
app.use('/api/v1/health', health_1.default);
// Authentication routes
app.use('/api/v1/auth', auth_1.default);
// Mobile routes
app.use('/api/v1/mobile', mobile_1.default);
// Users routes
app.use('/api/v1/users', users_1.default);
// Subjects routes
app.get('/api/v1/streams', subjectsController.getStreams);
app.get('/api/v1/teachers', subjectsController.getTeachersForSubject);
app.get('/api/v1/subjects', subjectsController.getSubjects);
app.use('/api/v1/subjects', subjects_1.default);
// centralized error handler - must be last
app.use(errorHandler_1.default);
exports.default = app;
