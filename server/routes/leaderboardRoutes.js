import express from 'express';
import protect  from '../middleware/authMiddleware.js';
import { getLeaderboard, getTop3, updateBio } from '../controllers/leaderboardController.js';

const router = express.Router();

router.get('/', getLeaderboard);  // GET /api/leaderboard?type=global
router.get('/top3', getTop3);     // GET /api/leaderboard/top3
router.patch('/bio', protect, updateBio);  // PATCH /api/leaderboard/bio

export default router;