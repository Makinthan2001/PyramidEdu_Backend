import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import errorHandler from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';
import authRouter from './modules/auth';
import healthRouter from './modules/health';
import mobileRouter from './modules/mobile';
import studentRouter from './modules/student/routes/student.routes';
import usersRouter from './modules/users';
import subjectsRouter from './modules/subjects';
import managerRouter from './modules/manager';
import studyMaterialsRouter from './modules/study-materials';

validateEnv();

const app = express();

// Secure security headers
app.use(helmet());

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

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting for auth routes
const authRateLimiter = rateLimit({
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


app.get('/', (req, res) => {
  res.send('PyramidEdu Backend Running');
});

// Health check routes
app.use('/api/v1/health', healthRouter);

// Authentication routes
app.use('/api/v1/auth', authRouter);
// app.use('/api/auth', authRouter);

// Mobile routes
app.use('/api/v1/mobile', mobileRouter);

// Users routes
app.use('/api/v1/users', usersRouter);

// Subjects routes
app.use('/api/v1/subjects', subjectsRouter);

// Student routes
app.use('/api/v1/students', studentRouter);

// Manager routes
app.use('/api/v1/manager', managerRouter);
// Study Materials routes
app.use('/api/v1/study-materials', studyMaterialsRouter);

// centralized error handler - must be last
app.use(errorHandler);

export default app;