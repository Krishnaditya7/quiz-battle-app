// ============================================================
// MATCHMAKING ROUTES
// Base: /api/match
// ============================================================

import express from 'express';
import protect from '../middleware/authmiddleware.js';
import { joinQueue, leaveQueue, getQueueStatus } from '../controllers/matchController.js';

const router = express.Router();

// All matchmaking routes are protected
router.use(protect);

router.post('/queue/join', joinQueue);
router.post('/queue/leave', leaveQueue);
router.get('/queue/status', getQueueStatus);

export default router;