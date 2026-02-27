// ============================================================
// MATCHMAKING CONTROLLER
// Handles: join queue, leave queue, get queue status
// Actual matching happens in Socket.IO (socketGameHandler.js)
// ============================================================

import User from '../models/Users.js';
import Team from '../models/Team.js';
import * as R from '../utils/redisGameService.js';

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
    const { topic, questionCount, opponentType, playMode, gameMode, stance, topicCategory } = req.body;
    const userId = req.userId;

    // ── Validate ──
    if (!topic || !playMode || !gameMode || !topicCategory) {
      return res.status(400).json({
        success: false,
        message: 'topic, playMode, gameMode, and topicCategory are required',
      });
    }

    const validGameModes = ['quiz', 'debate', 'discussion'];
    if (!validGameModes.includes(gameMode)) {
      return res.status(400).json({
        success: false,
        message: 'gameMode must be quiz, debate, or discussion',
      });
    }

    const validCategories = ['entertainment', 'learning'];
    if (!validCategories.includes(topicCategory)) {
      return res.status(400).json({
        success: false,
        message: 'topicCategory must be entertainment or learning',
      });
    }

    // opponentType NOT required for discussion mode
    if (gameMode !== 'discussion') {
      if (!opponentType) {
        return res.status(400).json({
          success: false,
          message: 'opponentType is required for quiz and debate modes',
        });
      }

      const validOpponentTypes = ['solo', 'duo', 'trio', 'squad', 'default'];
      if (!validOpponentTypes.includes(opponentType)) {
        return res.status(400).json({
          success: false,
          message: 'opponentType must be solo, duo, trio, squad, or default',
        });
      }
    }

    // ── Validate based on game mode ──
    if (gameMode === 'quiz') {
      const validQuestionCounts = [5, 10, 15, 20];
      if (!validQuestionCounts.includes(parseInt(questionCount))) {
        return res.status(400).json({
          success: false,
          message: 'For quiz mode, questionCount must be 5, 10, 15, or 20',
        });
      }
    }

    if (gameMode === 'debate') {
      if (!stance || !['for', 'against'].includes(stance)) {
        return res.status(400).json({
          success: false,
          message: 'For debate mode, stance must be "for" or "against"',
        });
      }
      const validQuestionCounts = [5, 10, 15, 20];
      if (!validQuestionCounts.includes(parseInt(questionCount))) {
        return res.status(400).json({
          success: false,
          message: 'For debate mode, questionCount (number of points) must be 5, 10, 15, or 20',
        });
      }
    }

    if (gameMode === 'discussion') {
      // No questionCount needed for discussion
    }

    const validOpponentTypes = ['solo', 'duo', 'trio', 'squad', 'default'];
    if (!validOpponentTypes.includes(opponentType)) {
      return res.status(400).json({
        success: false,
        message: 'opponentType must be solo, duo, trio, squad, or default',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ── Check if user is already in a queue ──
    const existingEntry = await R.getUserQueueEntry(userId);
    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'You are already in a queue. Leave current queue first.',
      });
    }

    let teamId = null;
    let teamLevel = user.level;
    let onlineTeamMembers = []; // ← ADDED: track who's actually online

    // ── If playing as team, validate currentTeam ──
    if (playMode === 'team') {
      if (!user.currentTeam) {
        return res.status(400).json({
          success: false,
          message: 'You must select a current team to play as team',
        });
      }

      const team = await Team.findById(user.currentTeam).populate('members.user', 'level');
      if (!team) {
        return res.status(404).json({ success: false, message: 'Current team not found' });
      }

      // Check if user is leader (only leader can queue the team)
      const member = team.members.find(m => m.user._id.toString() === userId);
      if (!member || member.role !== 'leader') {
        return res.status(403).json({
          success: false,
          message: 'Only team leader can start matchmaking',
        });
      }

      // ← CRITICAL FIX: Only include ONLINE members who are NOT in another game
      const onlineMembers = [];
      for (const m of team.members) {
        const memberId = m.user._id.toString();
        const isOnline = await R.isUserOnline(memberId);
        
        if (isOnline) {
          // Check if user is already in another game
          const userData = await R.getUserOnlineData(memberId);
          const isInGame = userData?.isInGame === 'true';
          
          if (!isInGame) {
            onlineMembers.push(memberId);
          }
        }
      }

      if (onlineMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No team members are available (all are offline or in another game)',
        });
      }

      // Set currentTeam for ALL available online members (not just leader)
      await Promise.all(
        onlineMembers.map(memberId => 
          User.findByIdAndUpdate(memberId, { currentTeam: user.currentTeam })
        )
      );

      onlineTeamMembers = onlineMembers; // ← STORE ONLINE MEMBERS
      teamId = team._id.toString();
      
      // Calculate team level (avg of ONLINE members only)
      const onlineMembersData = team.members.filter(m => onlineMembers.includes(m.user._id.toString()));
      teamLevel = Math.round(
        onlineMembersData.reduce((sum, m) => sum + m.user.level, 0) / onlineMembersData.length
      );
    }

    // ── Add to Redis queue ──
    await R.addToQueue(userId, {
      username: user.username,
      level: teamLevel,
      topic,
      questionCount: gameMode === 'discussion' ? 0 : parseInt(questionCount || 0),
      opponentType,
      playerClass: user.class,
      teamId,
      playMode,
      gameMode,
      stance: stance || null,
      topicCategory,
      onlineTeamMembers: onlineTeamMembers.join(','), // ← STORE IN QUEUE
    });

    return res.status(200).json({
      success: true,
      message: 'Added to matchmaking queue',
      queueData: { topic, questionCount, opponentType, playMode, gameMode, stance, topicCategory },
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
      entry.questionCount,
      entry.opponentType,
      entry.playerClass
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
      entry.playerClass
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