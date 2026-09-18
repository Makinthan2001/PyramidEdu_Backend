import { Router } from 'express';
import { askQuestion, getSession, clearConversation, deleteMessage } from '../controller/chat.controller';
import { authenticate } from '../../../middleware/authenticate';

const router = Router();

// Protect the route so only authenticated users (students/teachers) can ask questions
router.post('/ask', authenticate, askQuestion);

// Get chat history for the current user
router.get('/session', authenticate, getSession);

// Clear entire conversation / chat history
router.delete('/clear', authenticate, clearConversation);

// Delete an individual message
router.delete('/message/:messageId', authenticate, deleteMessage);

export default router;
