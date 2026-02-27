// ============================================================
// GAME CONTROLLER (Phase 5)
// Handles: game history, leaderboard, user stats
// ============================================================

import Game from '../models/Game.js';
import User from '../models/Users.js';
import * as R from '../utils/redisGameService.js';

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

    const playerScores = await R.getPlayerScores(gameId);
    const teamScores = await R.getTeamScores(gameId);

    const teamAScore = parseInt(teamScores.teamA || 0);
    const teamBScore = parseInt(teamScores.teamB || 0);

    // Determine winner
    let winnerType, winner, winnerTeam, result;
    
    // Check if it's truly a solo game (both sides are solo)
    const isTrueSoloGame = session.mode === 'solo';
    
    if (teamAScore > teamBScore) {
      if (isTrueSoloGame) {
        winnerType = 'solo';
        winner = teamAMembers[0]; // solo player from team A
      } else {
        winnerType = 'team';
        winnerTeam = session.teamAId;
      }
      result = 'win';
    } else if (teamBScore > teamAScore) {
      if (isTrueSoloGame) {
        winnerType = 'solo';
        winner = teamBMembers[0]; // solo player from team B
      } else {
        winnerType = 'team';
        winnerTeam = session.teamBId;
      }
      result = 'win';
    } else {
      result = 'draw';
    }

    // Find MVP (highest individual score)
    let mvp = null, mvpScore = -1;
    Object.entries(playerScores).forEach(([uid, score]) => {
      if (parseInt(score) > mvpScore) {
        mvpScore = parseInt(score);
        mvp = uid;
      }
    });

    // Build participants array
    const teamAMembers = session.teamAMembers ? session.teamAMembers.split(',') : [];
    const teamBMembers = session.teamBMembers ? session.teamBMembers.split(',') : [];
    
    const participants = [
      ...teamAMembers.map(userId => ({
        user: userId,
        team: session.teamAId && !session.teamAId.startsWith('solo_') ? session.teamAId : null,
        finalScore: parseInt(playerScores[userId] || 0),
        isMVP: userId === mvp,
        hasLeft: false,
      })),
      ...teamBMembers.map(userId => ({
        user: userId,
        team: session.teamBId && !session.teamBId.startsWith('solo_') ? session.teamBId : null,
        finalScore: parseInt(playerScores[userId] || 0),
        isMVP: userId === mvp,
        hasLeft: false,
      })),
    ];

    // For quiz mode: get questions from Redis
    let questions = [];
    if (session.gameMode === 'quiz') {
      // Get all questions asked during the game
      // Questions are stored when asked and answered
      const questionHistory = await R.getQuestionHistory(gameId);
      questions = questionHistory || [];
    }

    // For debate mode: get debate arguments (NOT questions!)
    let debateArguments = [];
    if (session.gameMode === 'debate') {
      const debatePoints = await R.getDebatePoints(gameId);
      debateArguments = debatePoints.map(p => ({
        presentedBy: p.userId,
        team: p.team,
        stance: p.team === 'teamA' ? session.teamAStance : session.teamBStance,
        argument: p.point,
        turnNumber: p.turnNumber || 0,
        timestamp: p.timestamp,
      }));
    }

    // Create game document
    const game = await Game.create({
      mode: session.mode,
      gameMode: session.gameMode,
      topic: session.topic,
      totalQuestions: parseInt(session.totalQuestions || 0),
      opponentType: session.opponentType || 'default',
      participants,
      questions: session.gameMode === 'quiz' ? questions : [],           // Only for quiz
      debateArguments: session.gameMode === 'debate' ? debateArguments : [], // Only for debate
      winnerType,
      winner: session.mode === 'solo' && result === 'win' ? winner : null,
      winnerTeam: winnerTeam || null,
      result,
      finalScore: Math.max(teamAScore, teamBScore),
      mvp,
    });

    // Update user stats for all participants
    for (const p of participants) {
      const userTeam = p.team ? 
        (session.teamAId === p.team.toString() ? 'teamA' : 'teamB') : 
        (teamAMembers.includes(p.user.toString()) ? 'teamA' : 'teamB');
      
      const didWin = (userTeam === 'teamA' && teamAScore > teamBScore) || 
                     (userTeam === 'teamB' && teamBScore > teamAScore);
      const isDraw = teamAScore === teamBScore;

      const updateFields = {
        $inc: {
          'stats.gamesPlayed': 1,
          'stats.totalPoints': p.finalScore,
          xp: session.gameMode === 'discussion' ? 0 : (didWin ? 50 : isDraw ? 20 : 10),
        },
      };

      if (didWin) {
        updateFields.$inc['stats.wins'] = 1;
      } else if (isDraw) {
        updateFields.$inc['stats.draws'] = 1;
      } else {
        updateFields.$inc['stats.losses'] = 1;
      }

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
      .populate('winner', 'username')
      .populate('winnerTeam', 'name')
      .populate('mvp', 'username');

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
// ─────────────────────────────────────────────
export const getGameDetails = async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = await Game.findById(gameId)
      .populate('participants.user', 'username level')
      .populate('participants.team', 'name dp')
      .populate('questions.askedBy', 'username')
      .populate('questions.answeredBy', 'username')
      .populate('winner', 'username')
      .populate('winnerTeam', 'name')
      .populate('mvp', 'username');

    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found' });
    }

    return res.status(200).json({ success: true, game });

  } catch (err) {
    console.error('Get game details error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

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
    const winRate = totalGames > 0 ? ((user.stats.wins / totalGames) * 100).toFixed(2) : 0;

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