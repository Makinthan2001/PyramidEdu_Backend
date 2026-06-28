"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const errorHandler_1 = __importDefault(require("./middleware/errorHandler"));
const validateEnv_1 = require("./utils/validateEnv");
const cloudinary_util_1 = require("./utils/cloudinary.util");
const auth_1 = __importDefault(require("./modules/auth"));
const health_1 = __importDefault(require("./modules/health"));
const mobile_1 = __importDefault(require("./modules/mobile"));
const student_routes_1 = __importDefault(require("./modules/student/routes/student.routes"));
const users_1 = __importDefault(require("./modules/users"));
const subjects_1 = __importDefault(require("./modules/subjects"));
const manager_1 = __importDefault(require("./modules/manager"));
const study_materials_1 = __importDefault(require("./modules/study-materials"));
const batches_1 = __importDefault(require("./modules/batches"));
const qr_1 = require("./modules/qr");
const attendance_1 = require("./modules/attendance");
const exams_1 = __importDefault(require("./modules/exams"));
const teachers_1 = __importDefault(require("./modules/teachers"));
const manual_exams_1 = __importDefault(require("./modules/manual-exams"));
const support_staff_1 = __importDefault(require("./modules/support-staff"));
const chat_1 = require("./modules/chat");
const announcements_1 = __importDefault(require("./modules/announcements"));
const notification_1 = __importDefault(require("./modules/notification"));
(0, validateEnv_1.validateEnv)();
(0, cloudinary_util_1.configureCloudinary)();
const app = (0, express_1.default)();
// Secure security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const corsOrigin = process.env.CORS_ORIGIN
    ? Array.from(new Set([
        ...process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
        'http://localhost:8081',
    ]))
    : ['http://localhost:3000', 'http://localhost:8081'];
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
// Serve static files from the uploads directory
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.get('/', (req, res) => {
    res.send('PyramidEdu Backend Running');
});
// Health check routes
app.use('/api/v1/health', health_1.default);
// Authentication routes
app.use('/api/v1/auth', auth_1.default);
// app.use('/api/auth', authRouter);
// Mobile routes
app.use('/api/v1/mobile', mobile_1.default);
// Users routes
app.use('/api/v1/users', users_1.default);
// Subjects routes
app.use('/api/v1/subjects', subjects_1.default);
// Student routes
app.use('/api/v1/students', student_routes_1.default);
// Manager routes
app.use('/api/v1/manager', manager_1.default);
app.use('/api/v1/study-materials', study_materials_1.default);
app.use('/api/v1/batches', batches_1.default);
app.use('/api/v1/qr', qr_1.qrRoutes);
app.use('/api/v1/attendance', attendance_1.attendanceRoutes);
// Teachers routes
app.use('/api/v1/teachers', teachers_1.default);
app.use('/api/v1/manual-exams', manual_exams_1.default);
// Support Staff routes
app.use('/api/v1/support-staff', support_staff_1.default);
// Exams routes
app.use('/api/v1/exams', exams_1.default);
// Chat routes
app.use('/api/v1/chat', chat_1.chatRouter);
// Announcements routes
app.use('/api/v1/announcements', announcements_1.default);
// Notifications routes
app.use('/api/v1/notifications', notification_1.default);
// centralized error handler - must be last
app.use(errorHandler_1.default);
exports.default = app;
