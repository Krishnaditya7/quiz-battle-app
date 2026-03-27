// ============================================================
// TOPIC ROUTES
// Base: /api/topics
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getCachedTopics, fetchAndCacheTopics } from '../utils/Topicservice.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/topics
// Returns all trending topic categories with questions
// Public — no auth needed (used in game setup screen)
// ─────────────────────────────────────────────
router.get('/gettopic', async (req, res) => {
  try {
    const data = await getCachedTopics();
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error('Get topics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch topics' });
  }
});

// ─────────────────────────────────────────────
// POST /api/topics/refresh
// Force refresh topics (admin only or for testing)
// Protected — requires auth
// ─────────────────────────────────────────────
router.post('/refresh', protect, async (req, res) => {
  try {
    const data = await fetchAndCacheTopics();
    return res.status(200).json({ success: true, message: 'Topics refreshed', ...data });
  } catch (err) {
    console.error('Refresh topics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to refresh topics' });
  }
});

export default router;