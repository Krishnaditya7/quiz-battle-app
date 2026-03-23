import User from '../models/Users.js';
import redis from '../config/redis.js';

// Get top 100 players
export const getLeaderboard = async (req, res) => {
  try {
    const { type = 'global' } = req.query;  // global, weekly, monthly
    const cacheKey = `leaderboard:${type}`;
    
    // Try Redis first (24h cache)
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        leaderboard: JSON.parse(cached),
        cached: true
      });
    }

    // Not in cache - calculate from MongoDB
    const leaderboard = await User.find()
      .select('username level xp  stats.gamesPlayed createdAt bio profilePic')
      .sort({
        level: -1,           // 1st: Highest level
        xp: -1,              // 2nd: Highest XP (if level tied)
        createdAt: 1         // 4th: Earliest join (if wins tied)
      })
      .limit(100)
      .lean();

    // Add rank
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    // Cache for 24 hours
    await redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(rankedLeaderboard));

    res.json({
      success: true,
      leaderboard: rankedLeaderboard,
      cached: false
    });

  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
};

// Get top 3 for homepage
export const getTop3 = async (req, res) => {
  try {
    const cacheKey = 'leaderboard:top3';
    
    // Try cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        top3: JSON.parse(cached)
      });
    }

    // Get from DB
    const top3 = await User.find()
      .select('username level xp stats.wins stats.gamesPlayed createdAt bio profilePic')
      .sort({
        level: -1,
        xp: -1,
        'stats.wins': -1,
        createdAt: 1
      })
      .limit(3)
      .lean();

    // Cache for 24h
    await redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(top3));

    res.json({
      success: true,
      top3
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top 3'
    });
  }
};

// Update bio (only for top 3)
export const updateBio = async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.userId;

    if (!bio || bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be 1-500 characters'
      });
    }

    // Update bio
    await User.findByIdAndUpdate(userId, { bio });

    // Invalidate cache
    await redis.del('leaderboard:top3');
    await redis.del('leaderboard:global');

    res.json({
      success: true,
      message: 'Bio updated successfully'
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update bio'
    });
  }
};

// Refresh leaderboard cache (run every 24h via cron)
export const refreshLeaderboardCache = async () => {
  try {
    console.log('🔄 Refreshing leaderboard cache...');

    // Clear old cache
    await redis.del('leaderboard:global');
    await redis.del('leaderboard:top3');

    // Recalculate
    const leaderboard = await User.find()
      .select('username level xp stats.wins stats.gamesPlayed createdAt bio profilePic')
      .sort({ level: -1, xp: -1, 'stats.wins': -1, createdAt: 1 })
      .limit(100)
      .lean();

    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    // Cache full leaderboard
    await redis.setex('leaderboard:global', 24 * 60 * 60, JSON.stringify(rankedLeaderboard));

    // Cache top 3
    const top3 = rankedLeaderboard.slice(0, 3);
    await redis.setex('leaderboard:top3', 24 * 60 * 60, JSON.stringify(top3));

    console.log('✅ Leaderboard cache refreshed!');
  } catch (err) {
    console.error('❌ Leaderboard refresh failed:', err);
  }
};