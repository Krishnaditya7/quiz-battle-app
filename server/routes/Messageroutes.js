import express from 'express';
import { getMessages, editMessage, deleteMessage, markAllAsRead } from '../controllers/messageController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:teamId/messages', protect, getMessages);        // load history
router.patch('/message/:messageId', protect, editMessage);    // edit
router.delete('/message/:messageId', protect, deleteMessage); // delete
router.patch('/:teamId/read', protect, markAllAsRead);        // mark all read

export default router;