import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';

validateEnv();

const app = express();

const corsOptions = { origin: process.env.CORS_ORIGIN || '*', optionsSuccessStatus: 200 };

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.send('PyramidEdu Backend Running');
});

// health and readiness endpoints
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/ready', (req, res) => res.status(200).json({ status: 'ready' }));

// TODO: mount API routes here (e.g. app.use('/api', routes))

// centralized error handler - must be last
app.use(errorHandler);

export default app;