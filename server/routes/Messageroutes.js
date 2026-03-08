

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { sendMessage, getMessages, markAsRead } from '../controllers/messageController.js';

const router = express.Router();

// All message routes are protected
router.use(protect);

router.post('/send', sendMessage);
router.get('/:teamId', getMessages);
router.post('/:messageId/read', markAsRead);

export default router;