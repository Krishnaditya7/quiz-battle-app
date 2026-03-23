// ============================================================
// GAME CONTROLLER (Phase 5)
// Handles: game history, leaderboard, user stats
// ============================================================

import Game from '../models/Game.js';
import User from '../models/Users.js';
import * as R from '../utils/redisGameServices.js';

// ─────────────────────────────────────────────
// INTERNAL: Save completed game from Redis to MongoDB
// Called by Socket.IO when game ends
// ─────────────────────────────────────────────
export const saveCompletedGame = async (gameId) => {
  try {
    const session = await R.getGameSession(gameId);
    if (!session || !session.gameId) {
      console.error('Game session not found in Redis:', gameId);
      return null;
    }

    

    // Build participants array
    const teamAMembers = session.teamAMembers ? session.teamAMembers.split(',') : [];
    const teamBMembers = session.teamBMembers ? session.teamBMembers.split(',') : [];
    
    const participants = [
      ...teamAMembers.map(userId => ({
        user: userId,
        team: session.teamAId && !session.teamAId.startsWith('solo_') ? session.teamAId : null,
        hasLeft: false,
      })),
      ...teamBMembers.map(userId => ({
        user: userId,
        team: session.teamBId && !session.teamBId.startsWith('solo_') ? session.teamBId : null,
        hasLeft: false,
      })),
    ];

    // For quiz mode: get questions from Redis
    let questions = [];
    
      // Get all questions asked during the game
      // Questions are stored when asked and answered
      const questionHistory = await R.getQuestionHistory(gameId);
      questions = questionHistory || [];
    


    // Create game document
    const game = await Game.create({
      topic: session.topic,
      totalQuestions: parseInt(session.totalQuestions || 0),
      opponentType: session.opponentType || 'default',
      participants,
      questions: questions,       
    });


    for (const p of participants) {
      const userTeam = p.team ? 
        (session.teamAId === p.team.toString() ? 'teamA' : 'teamB') : 
        (teamAMembers.includes(p.user.toString()) ? 'teamA' : 'teamB');
      

      const updateFields = {
        $inc: {
          'stats.gamesPlayed': 1,
          'stats.totalPoints': p.finalScore,
         // xp: we will inc as per the scores gained by user,
        },
      };


      const user = await User.findByIdAndUpdate(p.user, updateFields, { new: true });
      
      // Check for level up
      if (user) {
        user.checkLevelUp();
        await user.save();
      }
    }

    console.log(`✅ Game ${gameId} saved to MongoDB`);
    return game;

  } catch (err) {
    console.error('Error saving completed game:', err);
    return null;
  }
};

// ─────────────────────────────────────────────
// GET /api/game/history
// Query params: ?limit=20&skip=0
// Get user's game history
// ─────────────────────────────────────────────
export const getGameHistory = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const userId = req.userId;

    const games = await Game.find({
      'participants.user': userId,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('participants.user', 'username level')
      .populate('participants.team', 'name dp')

    const total = await Game.countDocuments({ 'participants.user': userId });

    return res.status(200).json({
      success: true,
      games,
      total,
      hasMore: skip + games.length < total,
    });

  } catch (err) {
    console.error('Get game history error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/game/:gameId
// Get single game details
// ─────────────────────────────────────────────d' }););

// ─────────────────────────────────────────────
// GET /api/game/leaderboard
// Query params: ?type=global|friends&limit=100
// Get leaderboard
// ─────────────────────────────────────────────
export const getLeaderboard = async (req, res) => {
  try {
    const { type = 'global', limit = 100 } = req.query;
    const userId = req.userId;

    let filter = {};

    if (type === 'friends') {
      const user = await User.findById(userId).select('friends');
      filter = { _id: { $in: [...user.friends, userId] } };
    }

    const leaderboard = await User.find(filter)
      .select('username level xp stats')
      .sort({ xp: -1, 'stats.wins': -1 })
      .limit(parseInt(limit));

    // Add rank
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      ...user.toObject(),
    }));

    return res.status(200).json({ success: true, leaderboard: rankedLeaderboard });

  } catch (err) {
    console.error('Get leaderboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/game/stats/:userId
// Get detailed stats for a user
// ─────────────────────────────────────────────
export const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username level xp stats');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate win rate
    const totalGames = user.stats.gamesPlayed;

    // Get recent games
    const recentGames = await Game.find({ 'participants.user': userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('mode topic result createdAt');

    return res.status(200).json({
      success: true,
      stats: {
        ...user.toObject(),
        winRate: parseFloat(winRate),
        recentGames,
      },
    });

  } catch (err) {
    console.error('Get user stats error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};