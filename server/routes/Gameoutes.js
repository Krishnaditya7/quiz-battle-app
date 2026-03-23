// routes/gameRoutes.js
import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getGameHistory } from '../controllers/Gamehistorycontroller.js';

const router = express.Router();

router.get('/history', protect, getGameHistory);

export default router;