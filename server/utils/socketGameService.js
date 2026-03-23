// ============================================================
// SOCKET.IO GAME HANDLER — COMPLETE REWRITE WITH TEMP TEAMS
// ============================================================

import { v4 as uuid } from 'uuid';
import redis from '../config/redis.js';
import K from '../config/redisKeys.js';
import * as R from '../utils/redisGameServices.js';
import { saveCompletedGame } from '../controllers/gameController.js';
import User from '../models/Users.js';
import { generateDiscussionQuestion } from './aiHelpers.js';
import Team from '../models/Team.js';
import Message from '../models/Message.js';
import GameHistory from '../models/Gamehistory.js';

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Add this helper function at the top of socketGameService.js
export const sendNotificationToUser = async (io, recipientId, notification) => {
  const userData = await R.getUserOnlineData(recipientId);
  if (userData?.socketId) {
    io.to(`user:${recipientId}`).emit('notification:new', { notification });
  }
};

export const registerGameSockets = (io) => {

    redis.config('SET', 'notify-keyspace-events', 'Ex');
    const redisSub = redis.duplicate();
    redisSub.subscribe('__keyevent@0__:expired');

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on('user:online', async ({ userId, username, level }) => {
        socket.userId = userId;
        await R.setUserOnline(userId, socket.id, username, level);
        socket.join(`user:${userId}`);
        console.log(`👤 ${username} is online`);
        });
      socket.on('match:joinQueue', async ({ userId, topic, questionCount, 
       opponentType, playerCount, teamId }) => {
      try {



        // ── Validate ──
        if (!userId || !topic || !questionCount || !playerCount || !opponentType) {
          return socket.emit('error', { message: 'Missing required fields' });
        }
        if (!['solo', 'duo', 'trio', 'squad', 'default'].includes(opponentType)) {
          return socket.emit('error', { message: 'Invalid opponent type' });
        }
        if (![5, 10, 15, 20].includes(parseInt(questionCount))) {
          return socket.emit('error', { message: 'Invalid question count' });
        }
        if (playerCount < 1 || playerCount > 4) {
          return socket.emit('error', { message: 'playerCount must be 1-4' });
        }

        // ── Already in queue? ──
        const existingEntry = await R.getUserQueueEntry(userId);
        if (existingEntry) {
          return socket.emit('error', { message: 'Already in queue. Leave first.' });
        }

        // ── Get user ──
        const user = await User.findById(userId)
          .select('username level class currentTeam');
        if (!user) {
          return socket.emit('error', { message: 'User not found' });
        }
        socket.userId = userId;

        // ── Helper: class string → number ──
        const classToNum = (cls) => {
          if (!cls) return 9;
          if (cls === 'Other' || cls === 'College') return 13;
          const num = parseInt(cls);
          return isNaN(num) ? 9 : num;
        };

        // ════════════════════════════════════
        // ── SOLO PATH — handle first, return early ──
        // ════════════════════════════════════
        if (!teamId) {
          // Clear currentTeam just in case (safety)
          await User.findByIdAndUpdate(userId, { $unset: { currentTeam: '' } });

          await R.addToQueue(userId, {
            username: user.username,
            level: user.level,
            playerClass: user.class || 'Other',
            topic,
            questionCount: parseInt(questionCount),
            playerCount,
        opponentType,
        teamId: null,
        onlineTeamMembers: '',
      });

      socket.join(`queue:${topic}:${questionCount}`);

      socket.emit('match:queued', {
        message: 'Searching for opponent...',
        queueData: { topic, questionCount, playerCount, opponentType },
        myTeam: {
          name: user.username,
          members: [{ username: user.username, level: user.level, avatar: '👤' }]
        }
      });

      console.log(`🎯 Solo queue: ${user.username}`);
      await tryMatch(io, { topic, questionCount, teamId});
      return; // ← exit here, never reaches team logic
    }

    // ════════════════════════════════════
    // ── TEAM PATH ──
    // ════════════════════════════════════
    const team = await Team.findById(teamId)
      .populate('members.user', 'level class username');

    if (!team) {
      // currentTeam set but team deleted — clean up and treat as solo
      await User.findByIdAndUpdate(userId, { $unset: { currentTeam: '' } });
      return socket.emit('error', { message: 'Your team no longer exists. Please try again.' });
    }

    // Only leader can start queue
    const leaderMember = team.members.find(
      m => m.user._id.toString() === userId
    );
    if (!leaderMember || leaderMember.role !== 'leader') {
      return socket.emit('error', { message: 'Only team leader can start matchmaking' });
    }

    // ── Find online, available members ──
    const onlineMembers = [];

    for (const m of team.members) {
      const memberId = m.user._id.toString();

      const isOnline = await R.isUserOnline(memberId);
      if (!isOnline) {
        console.log(`⚠️ ${m.user.username} is offline — skipping`);
        continue;
      }

      const memberData = await R.getUserOnlineData(memberId);
      if (memberData?.isInGame === 'true') {
        console.log(`⚠️ ${m.user.username} is in a game — skipping`);
        continue;
      }

      const alreadyQueued = await R.getUserQueueEntry(memberId);
      if (alreadyQueued) {
        console.log(`⚠️ ${m.user.username} already in queue — skipping`);
        continue;
      }

      onlineMembers.push({
        userId: memberId,
        username: m.user.username,
        level: m.user.level,
        class: m.user.class,
      });
    }

    if (onlineMembers.length === 0) {
      return socket.emit('error', { message: 'No team members are available' });
    }

    // ── Calculate team averages ──
    const teamLevel = Math.round(
      onlineMembers.reduce((sum, m) => sum + (m.level || 1), 0) / onlineMembers.length
    );

    const avgClassNum = Math.round(
      onlineMembers.reduce((sum, m) => sum + classToNum(m.class), 0) / onlineMembers.length
    );
    const teamClass = avgClassNum >= 13 ? 'College' : String(avgClassNum);

    
    const teamName = team.name;
    const onlineTeamMembersStr = onlineMembers.map(m => m.userId).join(',');

    // ── myTeam object built ONCE, sent to everyone ──
    const myTeamData = {
      name: teamName,
      members: onlineMembers.map(m => ({
        username: m.username,
        level: m.level,
        avatar: '👤'
      }))
    };

    const queueData = {
      topic,
      questionCount: parseInt(questionCount),
      playerCount,
      opponentType,
    };

    // ── Add each member to queue + notify ──
    for (const m of onlineMembers) {
      await R.addToQueue(m.userId, {
        username: m.username,
        level: teamLevel,          // team avg level
        playerClass: teamClass,    // team avg class
        topic,
        questionCount: parseInt(questionCount),
        playerCount,
        opponentType,
        teamId,
        onlineTeamMembers: onlineTeamMembersStr,
      });

      const memberSocketData = await R.getUserOnlineData(m.userId);
      if (!memberSocketData?.socketId) continue;

      const memberSocket = io.sockets.sockets.get(memberSocketData.socketId);
      if (!memberSocket) continue;

      memberSocket.join(`queue:${topic}:${questionCount}`);

      // Every member gets full team data ✅
      memberSocket.emit('match:queued', {
        message: 'Your team is searching for opponents!',
        queueData,
        myTeam: myTeamData,
      });
    }

    console.log(`👥 Team queue: ${teamName} — ${onlineMembers.length} members`);
    await tryMatch(io, { topic, questionCount, teamId});

  } catch (err) {
    console.error('Join queue error:', err);
    socket.emit('error', { message: 'Failed to join queue' });
  }
});
socket.on('queue:leave', async (data) => {
  try {
    if (!data || !data.userId) {
      return socket.emit('error', { message: 'userId required' });
    }

    const { userId, topic, questionCount} = data;
    const queueEntry = await R.getUserQueueEntry(userId);

    if (!queueEntry) {
      return socket.emit('queue:left', { message: 'Not in queue' });
    }

    if (queueEntry.teamId && queueEntry.teamId !== '') {
      // ── TEAM QUEUE: verify this user is the leader ──
      const team = await Team.findById(queueEntry.teamId);
      if (!team) {
        return socket.emit('error', { message: 'Team not found' });
      }

      const member = team.members.find(m => m.user.toString() === userId);
      if (!member || member.role !== 'leader') {
        // Non-leader tried to leave — block it
        return socket.emit('error', { 
          message: 'Only the team leader can leave the queue' 
        });
      }

      // Leader leaving — remove ALL members
      const memberIds = queueEntry.onlineTeamMembers
        ? queueEntry.onlineTeamMembers.split(',')
        : [userId];

      for (const memberId of memberIds) {
        await R.removeFromQueue(memberId, topic, questionCount);

        const memberData = await R.getUserOnlineData(memberId);
        if (!memberData?.socketId) continue;

        const memberSocket = io.sockets.sockets.get(memberData.socketId);
        if (!memberSocket) continue;

        memberSocket.leave(`queue:${topic}:${questionCount}`);

        // Redirect ALL members back to /game
        memberSocket.emit('queue:left', { 
          message: 'Leader left the queue',
          redirect: '/game'   // ← frontend uses this
        });
      }

    } else {
      // ── SOLO QUEUE ──
      await R.removeFromQueue(userId, topic, questionCount);
      socket.leave(`queue:${topic}:${questionCount}`);
      socket.emit('queue:left', { 
        message: 'Left queue successfully',
        redirect: '/game'
      });
    }

    console.log(`✅ User ${userId} left queue`);

  } catch (err) {
    console.error('Queue leave error:', err);
    socket.emit('error', { message: 'Failed to leave queue' });
  }
});
// ─────────────────────────────────────────────
// CHAT SOCKET EVENTS
// ─────────────────────────────────────────────

socket.on('chat:join', async ({ teamId, userId }) => {
  // Join the team chat room
  socket.join(`chat:${teamId}`);
  console.log(`💬 ${userId} joined chat:${teamId}`);
});

socket.on('chat:leave', ({ teamId }) => {
  socket.leave(`chat:${teamId}`);
});

socket.on('chat:sendMessage', async ({ teamId, type, content, replyTo }) => {
  try {
    const userId = socket.userId;
    if (!userId) return socket.emit('error', { message: 'Not authenticated' });

    if (!teamId || !type || !content?.trim()) {
      return socket.emit('error', { message: 'teamId, type and content required' });
    }

    // Verify membership
    const team = await Team.findById(teamId);
    if (!team) return socket.emit('error', { message: 'Team not found' });

    const isMember = team.members.some(m => m.user.toString() === userId);
    if (!isMember) return socket.emit('error', { message: 'Not a team member' });

    // Save to MongoDB
    const message = await Message.create({
      sender: userId,
      team: teamId,
      type,
      content: content.trim(),
      replyTo: replyTo || null,
    });

    // Populate sender info for display
    await message.populate('sender', 'username level profilePic');
    if (replyTo) {
      await message.populate('replyTo', 'content sender type');
    }

    // Broadcast to ALL online team members in this chat room
    io.to(`chat:${teamId}`).emit('chat:newMessage', { message });

    console.log(`💬 Message sent in team ${teamId} by ${userId}`);

  } catch (err) {
    console.error('Chat send error:', err);
    socket.emit('error', { message: 'Failed to send message' });
  }
});

socket.on('chat:typing', ({ teamId, userId, username }) => {
  // Broadcast typing indicator to everyone except sender
  socket.to(`chat:${teamId}`).emit('chat:userTyping', { userId, username });
});

socket.on('chat:stopTyping', ({ teamId, userId }) => {
  socket.to(`chat:${teamId}`).emit('chat:userStoppedTyping', { userId });
});

socket.on('chat:deleteMessage', async ({ teamId, messageId, deleteFor }) => {
  try {
    const userId = socket.userId;
    const message = await Message.findById(messageId);
    if (!message) return socket.emit('error', { message: 'Message not found' });

    if (deleteFor === 'everyone') {
      if (message.sender.toString() !== userId) {
        return socket.emit('error', { message: 'Only sender can delete for everyone' });
      }
      await Message.findByIdAndDelete(messageId);
      // Tell everyone in room to remove this message
      io.to(`chat:${teamId}`).emit('chat:messageDeleted', { 
        messageId, 
        deletedFor: 'everyone' 
      });
    } else {
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }
      // Only tell this user's socket
      socket.emit('chat:messageDeleted', { 
        messageId, 
        deletedFor: 'me' 
      });
    }
  } catch (err) {
    socket.emit('error', { message: 'Failed to delete message' });
  }
});

socket.on('chat:editMessage', async ({ teamId, messageId, content }) => {
  try {
    const userId = socket.userId;
    const message = await Message.findById(messageId);

    if (!message) return socket.emit('error', { message: 'Message not found' });
    if (message.sender.toString() !== userId) {
      return socket.emit('error', { message: 'Can only edit your own messages' });
    }
    if (message.type !== 'text') {
      return socket.emit('error', { message: 'Can only edit text messages' });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Tell everyone in room about the edit
    io.to(`chat:${teamId}`).emit('chat:messageEdited', { message });

  } catch (err) {
    socket.emit('error', { message: 'Failed to edit message' });
  }
});
//-------------------------------------------------------------------------------------------------------------------------------
  socket.on('game:join', async ({ gameId, userId }) => {
  socket.join(`game:${gameId}`);
  await R.registerPlayerSocket(gameId, userId, socket.id);
  await R.setUserInGame(userId, gameId);

  const session = await R.getGameSession(gameId);
  const activePlayers = await R.getActivePlayers(gameId);
  const teamAIds = session.teamAMembers.split(',').filter(Boolean);
  const teamBIds = session.teamBMembers.split(',').filter(Boolean);
  const totalExpected = teamAIds.length + teamBIds.length;

  io.to(`game:${gameId}`).emit('game:playerJoined', { 
    userId, 
    activePlayers, 
    session 
  });

  // All players joined → start the game
  if (activePlayers.length >= totalExpected) {
    const alreadyStarted = await redis.get(`game:${gameId}:started`);
    if (alreadyStarted) return;
    await redis.set(`game:${gameId}:started`, '1', 'EX', 3600);

    await startDiscussionGame(io, gameId, session);
  }
 });
  socket.on('game:chat:send', ({ gameId, userId, username, message }) => {
  io.to(`game:${gameId}`).emit('game:chat:message', {
    userId, username, message, timestamp: Date.now()
  });
});

 socket.on('game:voteNextQuestion', async ({ gameId, userId }) => {
  try {
    const session = await R.getGameSession(gameId);
    if (session.status !==  'discussion') return;

    // Track who voted
    await R.addNextQuestionVote(gameId, userId);
    const votes = await R.getNextQuestionVotes(gameId);

    const activePlayers = await R.getActivePlayers(gameId);
    
    // Notify everyone of vote progress
    io.to(`game:${gameId}`).emit('game:nextQuestionVote', {
      votes: votes.length,
      required: activePlayers.length,
      votedUserIds: votes,
    });

    // ALL players voted → move to next question
    if (votes.length >= activePlayers.length) {
      const currentQ = parseInt(session.currentQuestionNumber || 1);
      const nextQ = currentQ + 1;

      // Clear votes
      await R.clearNextQuestionVotes(gameId);

      // Check if game is over
      if (nextQ > parseInt(session.totalQuestions)) {
        await endDiscussionGame(io, gameId);
        return;
      }

      // Get pre-fetched next question
      const question = await R.getDiscussionQuestion(gameId, nextQ);
      await R.setCurrentQuestionNumber(gameId, nextQ);

      io.to(`game:${gameId}`).emit('game:discussionQuestion', {
        question,
        questionNumber: nextQ,
        totalQuestions: parseInt(session.totalQuestions),
      });

      // Pre-fetch the question after next
     generateDiscussionQuestion(session.topic, nextQ + 1)
  .then(q => R.setDiscussionQuestion(gameId, nextQ + 1, q))
  .catch(err => console.error(`Pre-fetch Q${nextQ + 1} error:`, err.message));
     
    }

  } catch (err) {
    console.error('voteNextQuestion error:', err);
    socket.emit('error', { message: 'Failed to process vote' });
  }
 });
 socket.on('game:ratePlayer', async ({ gameId, raterUserId, ratedUserId, stars, questionNumber, question }) => {
  try {
    // Validate
    if (!gameId || !raterUserId || !ratedUserId || !stars || !questionNumber) return;
    if (stars < 1 || stars > 5) return;
    if (raterUserId === ratedUserId) return; // can't rate yourself

    // Store in Redis — key: game:{gameId}:ratings
    // Format: JSON array pushed to a Redis list
    const ratingKey = `game:${gameId}:ratings`;
    const ratingEntry = JSON.stringify({
      raterUserId,
      ratedUserId,
      stars,
      questionNumber,
      question: question || '',
    });

    await redis.rpush(ratingKey, ratingEntry);
    await redis.expire(ratingKey, 7200); // 2 hours

    console.log(`⭐ ${raterUserId} rated ${ratedUserId} ${stars}★ for Q${questionNumber}`);

  } catch (err) {
    console.error('game:ratePlayer error:', err.message);
  }
});;

socket.on('game:leave', async ({ gameId, userId }) => {
  try {
    await R.removeActivePlayer(gameId, userId);
    await R.setUserOffGame(userId);
    socket.leave(`game:${gameId}`);

    const remainingPlayers = await R.getActivePlayers(gameId);

    io.to(`game:${gameId}`).emit('game:playerLeft', { 
      userId,
      remainingPlayers 
    });

    if (remainingPlayers.length === 0) {
      const session = await R.getGameSession(gameId);
      if (session) {
        await saveDiscussionHistory(gameId, session); // ← save before deleting
      }
      await R.deleteGameSession(gameId);
      await redis.del(`game:${gameId}:started`);
      console.log(`🗑️ Game ${gameId} ended — all players left`);
    }
  } catch (err) {
    console.error('game:leave error:', err);
  }
});
        socket.on('disconnect', async () => {
             console.log(`❌ Socket disconnected: ${socket.id}`);
       const userId = socket.userId;
       if (!userId) return;
       
       // Clean up queue
       const queueEntry = await R.getUserQueueEntry(userId);
       if (queueEntry) {
         if (queueEntry.teamId) {
           // Remove all team members from queue
           const members = queueEntry.onlineTeamMembers
             ? queueEntry.onlineTeamMembers.split(',')
             : [];
           for (const memberId of members) {
             await R.removeFromQueue(
               memberId,
               queueEntry.topic,
               queueEntry.questionCount
             );
           }
           console.log(`🧹 Removed team ${queueEntry.teamId} from queue on disconnect`);
         } else {
           await R.removeFromQueue(
             userId,
             queueEntry.topic,
             queueEntry.questionCount
           );
         }
       }
       
       await R.setUserOffline(userId);
      console.log(`👤 ${userId} marked offline`);
 });
 // Add inside io.on('connection', (socket) => { ... })
socket.on('webrtc:offer', ({ offer, targetUserId, fromUserId, gameId }) => {
  io.to(`user:${targetUserId}`).emit('webrtc:offer', { offer, fromUserId });
});
socket.on('webrtc:videoToggle', ({ gameId, userId, videoEnabled }) => {
  socket.to(`game:${gameId}`).emit('webrtc:videoToggle', { userId, videoEnabled });
});
socket.on('webrtc:answer', ({ answer, targetUserId, fromUserId }) => {
  io.to(`user:${targetUserId}`).emit('webrtc:answer', { answer, fromUserId });
});

socket.on('webrtc:ice', ({ candidate, targetUserId, fromUserId }) => {
  io.to(`user:${targetUserId}`).emit('webrtc:ice', { candidate, fromUserId });
});
});
};

// ═══════════════════════════════════════════════════════════════
// NEW TRY MATCH WITH TEMP TEAM FORMATION
// ══════════════════════════════════════════════════
async function tryMatch(io, { topic, questionCount}) {
  try {
    console.log(`🔍 Trying to match for ${topic}, ${questionCount} questions`);

    const allEntries = await R.getQueueEntries(topic, questionCount);

    if (allEntries.length < 2) {
      console.log('Not enough players in queue');
      return;
    }

    console.log(`Found ${allEntries.length} entries in queue`);

    // ── Helper: level and class compatibility ──
    const canMatch = (p1, p2) => {
      const levelDiff = Math.abs(parseInt(p1.level || 1) - parseInt(p2.level || 1));
      
      const classToNum = (cls) => {
        if (!cls) return 9;
        if (cls === 'Other' || cls === 'College') return 13;
        const num = parseInt(cls);
        return isNaN(num) ? 9 : num;
      };

      const classDiff = Math.abs(classToNum(p1.playerClass) - classToNum(p2.playerClass));
      
      const compatible = levelDiff <= 5 && classDiff <= 2;
      if (!compatible) {
        console.log(`❌ Level/class mismatch: ${p1.username}(${p1.level}) vs ${p2.username}(${p2.level})`);
      }
      return compatible; // ← actually returns true/false ✅
    };

    // ── Helper: how many players does this entry represent ──
    const getPlayerCount = (entry) => {
      // Solo player — no team
      if (!entry.teamId || entry.teamId === '') return 1;
      
      // Team player — count from onlineTeamMembers
      if (entry.onlineTeamMembers) {
        const members = entry.onlineTeamMembers.split(',').filter(Boolean);
        return members.length;
      }
      return 1;
    };

    // ── Convert opponentType to expected count ──
    const opponentTypeToCount = {
      'solo': 1, 'duo': 2, 'trio': 3, 'squad': 4
    };

    // ── Deduplicate entries by teamId ──
    // Multiple team members are in queue individually but represent ONE entry
    const seenTeams = new Set();
    const uniqueEntries = [];

    for (const queueEntry of allEntries) {
      if (queueEntry.teamId && queueEntry.teamId !== '') {
        if (seenTeams.has(queueEntry.teamId)) continue; // skip duplicate team members
        seenTeams.add(queueEntry.teamId);
      }
      uniqueEntries.push(queueEntry);
    }

    console.log(`Unique entries after dedup: ${uniqueEntries.length}`);

    if (uniqueEntries.length < 2) {
      console.log('Not enough unique entries after dedup');
      return;
    }

    // ── Match pairs ──
    for (let i = 0; i < uniqueEntries.length - 1; i++) {
      for (let j = i + 1; j < uniqueEntries.length; j++) {
        const e1 = uniqueEntries[i];
        const e2 = uniqueEntries[j];

        // Same team? skip
        if (e1.teamId && e1.teamId === e2.teamId) continue;

        // Level/class check
        if (!canMatch(e1, e2)) continue;

      

        // How many players each side has
        const e1Count = getPlayerCount(e1);
        const e2Count = getPlayerCount(e2);

        // What each side expects to face
        const e1Wants = opponentTypeToCount[e1.opponentType];
        const e2Wants = opponentTypeToCount[e2.opponentType];

        console.log(`Checking: ${e1.username}(has ${e1Count}, wants ${e1Wants}) vs ${e2.username}(has ${e2Count}, wants ${e2Wants})`);
     const e1Satisfied = !e1Wants || e2Count === e1Wants;
     const e2Satisfied = !e2Wants || e1Count === e2Wants;
     if (e1Satisfied && e2Satisfied) {
     console.log(`✅ MATCH: ${e1.username}(has ${e1Count}, wants ${e1.opponentType}) vs ${e2.username}(has ${e2Count}, wants ${e2.opponentType})`);
      await createMatch(io, e1, e2);
     return;
    }
    }
    }

    console.log('No compatible matches found in this iteration');

  } catch (err) {
    console.error('❌ tryMatch error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE MATCH FROM TWO ENTRIES
// ═══════════════════════════════════════════════════════════════

async function createMatch(io, entry1, entry2) {
    const gameId = uuid();
    
    console.log('🎮 Creating match:', gameId);
    console.log('Entry1:', entry1);
    console.log('Entry2:', entry2);
    
    // Get all user IDs
    const getMembers = async (entry) => {
  if (!entry.teamId || entry.teamId === '') {
    return [{
      userId: entry.userId,
      username: entry.username,
      level: entry.level,
      avatar: '👤'
    }];
  }
  const memberIds = entry.onlineTeamMembers.split(',').filter(Boolean);
  return await Promise.all(
    memberIds.map(async (userId) => {
      const userData = await R.getUserOnlineData(userId);
      return {
        userId,
        username: userData?.username || 'Unknown',
        level: userData?.level || 1,
        avatar: '👤'
      };
    })
  );
 }    
    const teamAMembers = await getMembers(entry1);
    const teamBMembers = await getMembers(entry2);
    
    console.log('TeamA members:', teamAMembers);
    console.log('TeamB members:', teamBMembers);
    
    const teamAUserIds = teamAMembers.map(m => m.userId);
    const teamBUserIds = teamBMembers.map(m => m.userId);
    // Create game session
    const firstTeam = Math.random() < 0.5 ? 'teamA' : 'teamB';
    const teamATurnOrder = shuffle(teamAUserIds);
    const teamBTurnOrder = shuffle(teamBUserIds);

    await R.createGameSession({
        gameId,
        topic: entry1.topic,
        totalQuestions: entry1.questionCount,
        teamAMembers: teamAUserIds,
        teamBMembers: teamBUserIds,
        currentTeam: firstTeam,
        questionsAsked: 0,
        status: 'greet',
      });


    // Emit to all players
    [...teamAUserIds, ...teamBUserIds].forEach(userId => {
  const isTeamA = teamAUserIds.includes(userId);
  io.to(`user:${userId}`).emit('match:found', {
    gameId,
    topic: entry1.topic,
    totalQuestions: entry1.questionCount,
    firstTeam,
    myTeamKey: isTeamA ? 'teamA' : 'teamB',
    myMembers: isTeamA ? teamAMembers : teamBMembers,       // ← full objects for display
    opponentMembers: isTeamA ? teamBMembers : teamAMembers, // ← full objects for display
  });
 });
    // Remove from queue
  
  await R.removeFromQueue(entry1.userId, entry1.topic, entry1.questionCount);
  await R.removeFromQueue(entry2.userId, entry2.topic, entry2.questionCount);
}

    async function startDiscussionGame(io, gameId, session) {
  // Start greet phase — players can turn on video/mic
  await R.setGameStatus(gameId, 'greet');
  io.to(`game:${gameId}`).emit('game:greetPhase', { 
    duration: 30, 
    gameId
  });
  // While players greet — fetch question 1 in background
  generateDiscussionQuestion(session.topic, 1)
    .then(question => R.setDiscussionQuestion(gameId, 1, question))
    .then(() => console.log(`✅ Q1 pre-fetched for game ${gameId}`))
    .catch(err => console.error('Pre-fetch Q1 error:', err.message));

  // After 30s greet — reveal question 1
  setTimeout(async () => {
    try {
        const question = await R.getDiscussionQuestion(gameId, 1);
const finalQuestion = question || `What are your thoughts on ${session.topic}?`;
await R.setGameStatus(gameId, 'discussion');
await R.setCurrentQuestionNumber(gameId, 1);

io.to(`game:${gameId}`).emit('game:discussionQuestion', {
  question: finalQuestion,
  questionNumber: 1,
  totalQuestions: parseInt(session.totalQuestions),
      });
   generateDiscussionQuestion(session.topic, 2)
  .then(q => R.setDiscussionQuestion(gameId, 2, q))
  .catch(err => console.error('Pre-fetch Q2 error:', err.message));

    } catch (err) {
      console.error('Discussion start error:', err);
    }
  }, 30000);
 }
 async function endDiscussionGame(io, gameId) {
  try {
    const session = await R.getGameSession(gameId);
    if (session) {
      await saveDiscussionHistory(gameId, session); // ← save before deleting
    }
    await R.deleteGameSession(gameId);
    await redis.del(`game:${gameId}:started`);
    io.to(`game:${gameId}`).emit('game:ended', {
      result: 'discussion_complete',
      message: 'Discussion session ended!'
    });
    console.log(`🏁 Discussion game ${gameId} ended`);
  } catch (err) {
    console.error('endDiscussionGame error:', err);
  }
}
async function saveDiscussionHistory(gameId, session) {
  try {
    const existing = await GameHistory.findOne({ gameId });
    if (existing) return;

    const teamAIds = session.teamAMembers.split(',').filter(Boolean);
    const teamBIds = session.teamBMembers.split(',').filter(Boolean);

    const buildPlayers = async (ids, team) => {
      return await Promise.all(ids.map(async (userId) => {
        const userData = await R.getUserOnlineData(userId);
        return { userId, username: userData?.username || 'Unknown', team };
      }));
    };

    const teamAPlayers = await buildPlayers(teamAIds, 'teamA');
    const teamBPlayers = await buildPlayers(teamBIds, 'teamB');

    const questions = [];
    const total = parseInt(session.currentQuestionNumber || session.totalQuestions || 1);
    for (let i = 1; i <= total; i++) {
      const text = await R.getDiscussionQuestion(gameId, i);
      if (text) questions.push({ number: i, text });
    }

    // ← Fetch ratings from Redis
    const ratings = await R.getGameRatings(gameId);

    await GameHistory.create({
      gameId,
      topic: session.topic,
      players: [...teamAPlayers, ...teamBPlayers],
      questions,
      ratings,           // ← save ratings array to MongoDB
      totalQuestions: questions.length,
      playedAt: new Date(),
    });

    // Clean up Redis ratings after saving
    await R.deleteGameRatings(gameId);

    console.log(`📝 Game history saved for ${gameId} with ${ratings.length} ratings`);
  } catch (err) {
    console.error('saveDiscussionHistory error:', err.message);
  }
}