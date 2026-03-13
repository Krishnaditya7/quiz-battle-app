// ============================================================
// MATCHMAKING ROUTES
// Base: /api/match
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import getQueueStatus  from '../controllers/matchController.js';

const router = express.Router();

// All matchmaking routes are protected
router.use(protect);
router.get('/queue/status', getQueueStatus);

export default router;