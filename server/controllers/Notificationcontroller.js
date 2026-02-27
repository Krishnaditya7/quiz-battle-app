// ============================================================
// NOTIFICATION CONTROLLER
// Handles: get notifications, mark as read, delete notification
// Notifications are created by various actions (team join requests, friend requests, etc.)
// ============================================================

import Notification from '../models/Notification.js';
import User from '../models/Users.js';

// ─────────────────────────────────────────────
// GET /api/notification
// Query params: ?limit=20&unreadOnly=true
// Get all notifications for current user
// ─────────────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const { limit = 20, unreadOnly } = req.query;
    const userId = req.userId;

    const filter = { recipient: userId };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username level')
      .populate('team', 'name dp topics')
      .populate('game', 'mode topic');

    return res.status(200).json({ success: true, notifications });

  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/notification/:notificationId/read
// Mark notification as read
// ─────────────────────────────────────────────
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if notification belongs to user
    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your notification' });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({ success: true, message: 'Marked as read' });

  } catch (err) {
    console.error('Mark notification as read error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/notification/mark-all-read
// Mark all notifications as read for current user
// ─────────────────────────────────────────────
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true, message: 'All notifications marked as read' });

  } catch (err) {
    console.error('Mark all as read error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/notification/:notificationId
// Delete a notification
// ─────────────────────────────────────────────
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if notification belongs to user
    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your notification' });
    }

    await Notification.findByIdAndDelete(notificationId);

    return res.status(200).json({ success: true, message: 'Notification deleted' });

  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/notification/clear-all
// Delete all notifications for current user
// ─────────────────────────────────────────────
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.deleteMany({ recipient: userId });

    return res.status(200).json({ success: true, message: 'All notifications cleared' });

  } catch (err) {
    console.error('Clear all notifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/notification/unread-count
// Get count of unread notifications
// ─────────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({ success: true, unreadCount: count });

  } catch (err) {
    console.error('Get unread count error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};