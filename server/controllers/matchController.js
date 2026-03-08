// ============================================================
// MATCHMAKING CONTROLLER
// Handles: join queue, leave queue, get queue status
// Actual matching happens in Socket.IO (socketGameHandler.js)
// ============================================================

import User from '../models/Users.js';
import Team from '../models/Team.js';
import * as R from '../utils/redisGameServices.js';

// ─────────────────────────────────────────────
// POST /api/match/queue/join
// Body: { topic, questionCount, opponentType, playMode, gameMode, stance?, topicCategory }
// playMode = 'solo' or 'team'
// gameMode = 'quiz' | 'debate' | 'discussion'
// stance = 'for' | 'against' (required for debate)
// topicCategory = 'entertainment' | 'learning' (affects level matching)
// ─────────────────────────────────────────────
export const joinQueue = async (req, res) => {
  try {
    const { topic, questionCount, opponentType, playerCount, gameMode, stance } = req.body;
    const userId = req.userId;

    // ── Validate ──
    if (!topic || !questionCount || !gameMode || !playerCount || !opponentType) {
      return res.status(400).json({
        success: false,
        message: 'topic, questionCount, gameMode, playerCount, and opponentType are required',
      });
    }

    if (playerCount < 1 || playerCount > 4) {
      return res.status(400).json({
        success: false,
        message: 'playerCount must be 1-4',
      });
    }

    const validGameModes = ['quiz', 'debate', 'discussion'];
    if (!validGameModes.includes(gameMode)) {
      return res.status(400).json({
        success: false,
        message: 'gameMode must be quiz, debate, or discussion',
      });
    }

    const validOpponentTypes = ['solo', 'duo', 'trio', 'squad','default'];
    if (!validOpponentTypes.includes(opponentType)) {
      return res.status(400).json({
        success: false,
        message: 'opponentType must be solo, duo, trio, or squad',
      });
    }

    const validQuestionCounts = [5, 10, 15, 20];
    if (!validQuestionCounts.includes(parseInt(questionCount))) {
      return res.status(400).json({
        success: false,
        message: 'questionCount must be 5, 10, 15, or 20',
      });
    }

    if (gameMode === 'debate' && (!stance || !['for', 'against'].includes(stance))) {
      return res.status(400).json({
        success: false,
        message: 'stance (for/against) required for debate',
      });
    }

    // ── Get user ──
    const user = await User.findById(userId).select('username level class currentTeam');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ── Already in queue? ──
    const existingEntry = await R.getUserQueueEntry(userId);
    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Already in queue. Leave first.',
      });
    }

    let teamId = null;
    let playerClass = user.class;
    let teamLevel = user.level;
    let onlineTeamMembers = [];

    // ── 🔥 KEY FIX: Only process team if currentTeam exists ──
    if (user.currentTeam) {
      const team = await Team.findById(user.currentTeam).populate('members.user', 'level class username');
      
      if (!team) {
        return res.status(404).json({ success: false, message: 'Team not found' });
      }

      // Check if leader
      const member = team.members.find(m => m.user._id.toString() === userId);
      if (!member || member.role !== 'leader') {
        return res.status(403).json({
          success: false,
          message: 'Only team leader can start matchmaking',
        });
      }

      // Get ONLINE members NOT in another game
      const onlineMembers = [];
      for (const m of team.members) {
        const memberId = m.user._id.toString();
        const isOnline = await R.isUserOnline(memberId);
        
        if (isOnline) {
          const userData = await R.getUserOnlineData(memberId);
          const isInGame = userData?.isInGame === 'true';
          
          if (!isInGame) {
            onlineMembers.push({
              userId: memberId,
              username: m.user.username,
              level: m.user.level,
              class: m.user.class,
            });
          }
        }
      }

      if (onlineMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No team members available',
        });
      }

      // Calculate average class
      const totalClass = onlineMembers.reduce((sum, m) => sum + m.class, 0);
      playerClass = Math.round(totalClass / onlineMembers.length);

      // Calculate average level
      const totalLevel = onlineMembers.reduce((sum, m) => sum + m.level, 0);
      teamLevel = Math.round(totalLevel / onlineMembers.length);

      onlineTeamMembers = onlineMembers.map(m => m.userId);
      teamId = team._id.toString();
    }
    // ── If playing solo (no currentTeam), just use user's own data ──
    // This part is already handled by default values above

    // ── Add to queue ──
    await R.addToQueue(userId, {
      username: user.username,
      level: teamLevel,
      playerClass,
      topic,
      questionCount: parseInt(questionCount),
      playerCount,
      opponentType,
      gameMode,
      stance: stance || null,
      teamId: teamId || '',
      onlineTeamMembers: onlineTeamMembers.join(','),
    });

    return res.status(200).json({
      success: true,
      message: 'Added to queue',
      queueData: {
        topic,
        questionCount,
        playerCount,
        opponentType,
        gameMode,
      },
    });

  } catch (err) {
    console.error('Join queue error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/match/queue/leave
// User leaves the matchmaking queue
// ─────────────────────────────────────────────
export const leaveQueue = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's queue entry
    const entry = await R.getUserQueueEntry(userId);
    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'You are not in any queue',
      });
    }

    // Remove from queue
    await R.removeFromQueue(
      userId,
      entry.topic,
      entry.gameMode,
      entry.questionCount,
      entry.opponentType,
      entry.playerCount
    );

    return res.status(200).json({
      success: true,
      message: 'Removed from matchmaking queue',
    });

  } catch (err) {
    console.error('Leave queue error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

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