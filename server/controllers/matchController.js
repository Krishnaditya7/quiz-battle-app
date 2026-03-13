// ============================================================
// MATCHMAKING CONTROLLER
// Handles: join queue, leave queue, get queue status
// Actual matching happens in Socket.IO (socketGameHandler.js)
// ============================================================

import User from '../models/Users.js';
import Team from '../models/Team.js';
import * as R from '../utils/redisGameServices.js';

// ─────────────────────────────────────────────
// GET /api/match/queue/status
// Get current queue status for user
// ─────────────────────────────────────────────
export const getQueueStatus = async (req, res) => {
  try {
    const userId = req.userId;

    const entry = await R.getUserQueueEntry(userId);
    if (!entry) {
      return res.status(200).json({
        success: true,
        inQueue: false,
      });
    }

    // Get queue length
    const queueLength = await R.getQueueLength(
      entry.topic,
      entry.questionCount,
      entry.opponentType,
      entry.gameMode,
      entry.playerCount
    );

    return res.status(200).json({
      success: true,
      inQueue: true,
      queueData: entry,
      queueLength,
    });

  } catch (err) {
    console.error('Get queue status error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
export default getQueueStatus;