// ============================================================
// GAME ROUTES
// Base: /api/game
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  getGameHistory,
  getGameDetails,
  getLeaderboard,
  getUserStats,
} from '../controllers/gameController.js';

const router = express.Router();

// All game routes are protected
router.use(protect);

router.get('/history', getGameHistory);
router.get('/leaderboard', getLeaderboard);
router.get('/stats/:userId', getUserStats);
router.get('/:gameId', getGameDetails);

export default router;