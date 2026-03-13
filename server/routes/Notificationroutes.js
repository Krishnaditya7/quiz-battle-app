// ============================================================
// NOTIFICATION ROUTES
// Base: /api/notification
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
} from '../controllers/Notificationcontroller.js';

const router = express.Router();

// All notification routes are protected
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:notificationId/read', markAsRead);
router.patch('/mark-all-read', markAllAsRead);
router.delete('/:notificationId', deleteNotification);
router.delete('/clear-all', clearAllNotifications);


export default router;