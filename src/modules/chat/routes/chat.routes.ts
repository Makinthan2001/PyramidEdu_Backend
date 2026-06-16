import { Router } from 'express';
import { askQuestion, getSession } from '../controller/chat.controller';
import { authenticate } from '../../../middleware/authenticate';

const router = Router();

// Protect the route so only authenticated users (students/teachers) can ask questions
router.post('/ask', authenticate, askQuestion);

// Get chat history for the current user
router.get('/session', authenticate, getSession);

export default router;
