// ============================================================
// FRIEND ROUTES
// Base: /api/friend
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriends,
} from '../controllers/Friendcontroller.js';

const router = express.Router();

// All friend routes are protected
router.use(protect);

router.post('/request', sendFriendRequest);
router.post('/accept', acceptFriendRequest);
router.post('/reject', rejectFriendRequest);
router.delete('/remove', removeFriend);
router.get('/list', getFriends);

export default router;