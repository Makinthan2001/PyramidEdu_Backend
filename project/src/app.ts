// ============================================================
// src/app.ts  (updated)
// Express application setup.
// Added: cookie-parser (for httpOnly refresh token cookies)
//        auth routes mounted at /api/auth
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import errorHandler from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';
import authRouter from './modules/auth';

validateEnv();

const app = express();

// ─── Core middleware ──────────────────────────────────────────
const corsOptions = {
  origin:      process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,               // required for cookies to work cross-origin
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());            // parse httpOnly cookies (refresh token)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Health checks ────────────────────────────────────────────
app.get('/',       (_req, res) => res.send('PyramidEdu Backend Running'));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/ready',  (_req, res) => res.status(200).json({ status: 'ready' }));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRouter);

// TODO: mount future module routes here
// app.use('/api/students', studentRouter);
// app.use('/api/teachers', teacherRouter);

// ─── Global error handler (must be last) ─────────────────────
app.use(errorHandler);

export default app;
