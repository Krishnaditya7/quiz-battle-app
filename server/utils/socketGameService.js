// ============================================================
// SOCKET.IO GAME HANDLER
// Handles all real-time game events.
// Import and call registerGameSockets(io) from server.js
// ============================================================

import { v4 as uuid } from 'uuid';
import redis from '../config/redis.js';
import K from '../config/redisKeys.js';
import * as R from '../utils/redisGameService.js';
import { saveCompletedGame } from '../controllers/gameController.js';
import User from '../models/Users.js';

// ─────────────────────────────────────────────
// HELPER: Shuffle array (for random turn order)
// ─────────────────────────────────────────────
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ─────────────────────────────────────────────
// HELPER: Check if answer is correct (60%+ word match)
// Excludes stop words
// ─────────────────────────────────────────────
const STOP_WORDS = new Set(['is', 'are', 'was', 'were', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'it', 'its']);

export const checkAnswerMatch = (givenAnswer, correctAnswer) => {
  const normalize = (str) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => !STOP_WORDS.has(w));

  const givenWords = normalize(givenAnswer);
  const correctWords = normalize(correctAnswer);

  if (!correctWords.length) return false;

  const matchCount = givenWords.filter(w => correctWords.includes(w)).length;
  const matchPercent = matchCount / correctWords.length;

  return matchPercent >= 0.6;
};

// ─────────────────────────────────────────────
// MAIN REGISTRATION FUNCTION
// Call this from server.js: registerGameSockets(io)
// ─────────────────────────────────────────────
export const registerGameSockets = (io) => {

  // ── Enable Redis keyspace expiry notifications ──
  // This lets us react when a timer key expires
  redis.config('SET', 'notify-keyspace-events', 'Ex');

  // Subscribe to expiry events on a separate Redis connection
  const redisSub = redis.duplicate();
  redisSub.subscribe('__keyevent@0__:expired');

  redisSub.on('message', async (channel, expiredKey) => {
    await handleTimerExpiry(io, expiredKey);
  });

  // ── Socket connection ──
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // USER COMES ONLINE
    // Emit from client on page load after login
    // ─────────────────────────────────────────────
    socket.on('user:online', async ({ userId, username, level }) => {
      socket.userId = userId;
      await R.setUserOnline(userId, socket.id, username, level);
      socket.join(`user:${userId}`); // personal room for notifications
      console.log(`👤 ${username} is online`);
    });

    // ─────────────────────────────────────────────
    // MATCHMAKING — JOIN QUEUE
    // ─────────────────────────────────────────────
    socket.on('match:joinQueue', async ({ userId, username, level, topic, questionCount, opponentType, playerClass, teamId }) => {
      try {
        await R.addToQueue(userId, { username, level, topic, questionCount, opponentType, playerClass, teamId });
        socket.join(`queue:${topic}:${questionCount}:${opponentType}:${playerClass}`);

        // Try to find a match immediately
        await tryMatch(io, socket, { topic, questionCount, opponentType, playerClass });

        socket.emit('match:queued', { message: 'Searching for opponent...' });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join queue' });
      }
    });

    // ─────────────────────────────────────────────
    // MATCHMAKING — LEAVE QUEUE
    // ─────────────────────────────────────────────
    socket.on('match:leaveQueue', async ({ userId, topic, questionCount, opponentType, playerClass }) => {
      await R.removeFromQueue(userId, topic, questionCount, opponentType, playerClass);
      socket.emit('match:leftQueue');
    });

    // ─────────────────────────────────────────────
    // PLAYER JOINS GAME ROOM (after being matched)
    // ─────────────────────────────────────────────
    socket.on('game:join', async ({ gameId, userId }) => {
      socket.join(`game:${gameId}`);
      await R.registerPlayerSocket(gameId, userId, socket.id);
      await R.setUserInGame(userId, gameId);

      const activePlayers = await R.getActivePlayers(gameId);
      const session = await R.getGameSession(gameId);

      io.to(`game:${gameId}`).emit('game:playerJoined', {
        userId,
        activePlayers,
        session,
      });
    });

    // ─────────────────────────────────────────────
    // GAME: ASK QUESTION (within 15s ask timer)
    // ─────────────────────────────────────────────
    socket.on('game:askQuestion', async ({ gameId, userId, question, voiceUrl }) => {
      try {
        const session = await R.getGameSession(gameId);
        if (session.status !== 'active') return;

        const currentAsker = await R.getCurrentAsker(gameId);
        if (currentAsker !== userId) {
          return socket.emit('error', { message: 'Not your turn to ask!' });
        }

        // Cancel the ask timer (player asked in time)
        await R.cancelTimer(K.timerAskQuestion(gameId));

        // TODO: Translate question to English here (call your translation API)
        const translatedQuestion = question; // Replace with actual translation

        // Save question to Redis
        await R.setCurrentQuestion(gameId, {
          question,
          translatedQuestion,
          askedBy: userId,
          askedByTeam: session.currentTeam,
        });

        // Broadcast question to all players
        io.to(`game:${gameId}`).emit('game:questionAsked', {
          question,
          translatedQuestion,
          askedBy: userId,
          voiceUrl: voiceUrl || null,
        });

        // TODO: Kick off AI answer computation in background
        // computeAIAnswer(gameId, translatedQuestion);  ← your AI call here

        // Start 10s pin window
        await R.startPinTimer(gameId);
        io.to(`game:${gameId}`).emit('game:pinStarted', {
          translatedQuestion,
          duration: 10,
        });

      } catch (err) {
        console.error('askQuestion error:', err);
        socket.emit('error', { message: 'Failed to process question' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: RAISE HAND (during 10s pin window)
    // ─────────────────────────────────────────────
    socket.on('game:raiseHand', async ({ gameId, userId }) => {
      try {
        const session = await R.getGameSession(gameId);
        const question = await R.getCurrentQuestion(gameId);

        if (question.status !== 'pinned') {
          return socket.emit('error', { message: 'Cannot raise hand now' });
        }

        // Block asker's team from raising hand
        if (question.askedByTeam === session.currentTeam) {
          return socket.emit('error', { message: "Your team asked — opponent team answers!" });
        }

        const raisedAt = await R.raiseHand(gameId, userId);
        const allHands = await R.getAllRaisedHands(gameId);

        io.to(`game:${gameId}`).emit('game:handRaised', {
          userId,
          raisedAt,
          allHands,
        });

      } catch (err) {
        socket.emit('error', { message: 'Failed to raise hand' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: LOWER HAND (team agreed on one person)
    // ─────────────────────────────────────────────
    socket.on('game:lowerHand', async ({ gameId, userId }) => {
      await R.lowerHand(gameId, userId);
      const allHands = await R.getAllRaisedHands(gameId);
      io.to(`game:${gameId}`).emit('game:handLowered', { userId, allHands });
    });

    // ─────────────────────────────────────────────
    // GAME: SUBMIT ANSWER
    // ─────────────────────────────────────────────
    socket.on('game:submitAnswer', async ({ gameId, userId, answer }) => {
      try {
        const session = await R.getGameSession(gameId);
        const question = await R.getCurrentQuestion(gameId);

        if (question.status === 'done') return;

        // Cancel answer timer
        await R.cancelTimer(K.timerAnswer(gameId));

        const correctAnswer = question.correctAnswer;
        const isCorrect = checkAnswerMatch(answer, correctAnswer);

        if (isCorrect) {
          // ✅ Correct! Award point to answerer and their team
          const opposingTeam = session.currentTeam === 'teamA' ? 'teamB' : 'teamA';
          const { playerScore, teamScore } = await R.awardPoint(gameId, userId, opposingTeam);

          await R.setQuestionAnswered(gameId, userId, answer, true);
          await R.clearRaisedHands(gameId);

          // Store question in history for game record
          const question = await R.getCurrentQuestion(gameId);
          await R.addQuestionToHistory(gameId, {
            askedBy: question.askedBy,
            askedByTeam: question.askedByTeam,
            question: question.question,
            translatedQuestion: question.translatedQuestion,
            correctAnswer: question.correctAnswer,
            answeredBy: userId,
            answeredByTeam: opposingTeam === 'teamA' ? session.teamAId : session.teamBId,
            givenAnswer: answer,
            isCorrect: true,
          });

          const scores = await R.getTeamScores(gameId);
          io.to(`game:${gameId}`).emit('game:answerResult', {
            isCorrect: true,
            answeredBy: userId,
            answer,
            correctAnswer,
            scores,
          });

          await proceedToNextTurn(io, gameId);

        } else {
          // ❌ Wrong — now the asker must answer their own question
          io.to(`game:${gameId}`).emit('game:answerWrong', {
            answeredBy: userId,
            answer,
          });

          // Give asker 15s to answer their own question (Condition A)
          await R.startAskerAnsTimer(gameId);
          io.to(`game:${gameId}`).emit('game:askerMustAnswer', {
            askerId: question.askedBy,
            duration: 15,
          });
        }

      } catch (err) {
        console.error('submitAnswer error:', err);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: ASKER ANSWERS THEIR OWN QUESTION (Condition A)
    // ─────────────────────────────────────────────
    socket.on('game:askerAnswer', async ({ gameId, userId, answer }) => {
      try {
        const question = await R.getCurrentQuestion(gameId);
        const session = await R.getGameSession(gameId);

        if (question.askedBy !== userId) {
          return socket.emit('error', { message: 'You are not the asker!' });
        }

        await R.cancelTimer(K.timerAskerAnswer(gameId));

        const isCorrect = checkAnswerMatch(answer, question.correctAnswer);

        if (isCorrect) {
          // Asker answered correctly → +1 to asker and their team
          const { playerScore, teamScore } = await R.awardPoint(gameId, userId, session.currentTeam);
          const scores = await R.getTeamScores(gameId);

          // Store question in history
          await R.addQuestionToHistory(gameId, {
            askedBy: userId,
            askedByTeam: session.currentTeam === 'teamA' ? session.teamAId : session.teamBId,
            question: question.question,
            translatedQuestion: question.translatedQuestion,
            correctAnswer: question.correctAnswer,
            answeredBy: userId,  // Asker answered their own question
            answeredByTeam: session.currentTeam === 'teamA' ? session.teamAId : session.teamBId,
            givenAnswer: answer,
            isCorrect: true,
          });

          io.to(`game:${gameId}`).emit('game:conditionAResult', {
            isCorrect: true,
            askerId: userId,
            answer,
            scores,
          });
        } else {
          // No one gets a point
          io.to(`game:${gameId}`).emit('game:conditionAResult', {
            isCorrect: false,
            askerId: userId,
            answer,
            scores: await R.getTeamScores(gameId),
          });
        }

        await R.clearRaisedHands(gameId);
        await proceedToNextTurn(io, gameId);

      } catch (err) {
        socket.emit('error', { message: 'Failed to process asker answer' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: SUBMIT DEBATE POINT (5 min timer, can stop early)
    // ─────────────────────────────────────────────
    socket.on('game:submitDebatePoint', async ({ gameId, userId, point, stoppedEarly }) => {
      try {
        const session = await R.getGameSession(gameId);
        if (session.gameMode !== 'debate') return;

        const currentAsker = await R.getCurrentAsker(gameId);
        if (currentAsker !== userId) {
          return socket.emit('error', { message: 'Not your turn!' });
        }

        // Cancel the 5min timer if stopped early
        if (stoppedEarly) {
          await R.cancelTimer(K.timerDebatePoint(gameId));
        }

        // Get current turn number
        const currentTurnIndex = parseInt(session.currentTurnIndex) + 1;

        // Store the debate point with turn number
        await R.addDebatePoint(gameId, userId, session.currentTeam, point, currentTurnIndex);

        io.to(`game:${gameId}`).emit('game:debatePointSubmitted', {
          userId,
          point,
          team: session.currentTeam,
          turnNumber: currentTurnIndex,
        });

        await proceedToNextTurn(io, gameId);

      } catch (err) {
        console.error('Submit debate point error:', err);
        socket.emit('error', { message: 'Failed to submit point' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: REQUEST NEXT DISCUSSION QUESTION (leader only)
    // ─────────────────────────────────────────────
    socket.on('game:requestNextQuestion', async ({ gameId, userId }) => {
      try {
        const session = await R.getGameSession(gameId);
        if (session.gameMode !== 'discussion') return;

        // Check if user is a leader (either from teamAEntries or teamBEntries original leader)
        const isLeader = await R.isDiscussionLeader(gameId, userId);
        if (!isLeader) {
          return socket.emit('error', { message: 'Only leaders can request next question' });
        }

        // Mark this leader as ready for next question
        await R.markLeaderReadyForNext(gameId, userId);

        // Check if BOTH leaders clicked
        const bothReady = await R.areBothLeadersReady(gameId);
        
        if (bothReady) {
          // Generate next question
          const currentQ = parseInt(session.currentQuestionNumber || 0);
          const nextQ = currentQ + 1;
          
          if (nextQ > parseInt(session.totalQuestions)) {
            // No more questions → end discussion
            io.to(`game:${gameId}`).emit('game:discussionEnded', {
              message: 'All questions discussed!',
            });
            await endGame(io, gameId);
          } else {
            const aiQuestion = await generateDiscussionQuestion(gameId, session.topic, nextQ);
            await R.updateGameSession(gameId, { currentQuestionNumber: nextQ });
            await R.clearLeaderReadyStates(gameId);
            
            io.to(`game:${gameId}`).emit('game:nextDiscussionQuestion', {
              questionNumber: nextQ,
              question: aiQuestion,
            });
          }
        } else {
          // Notify that one leader is ready, waiting for other
          io.to(`game:${gameId}`).emit('game:leaderReadyForNext', {
            leaderId: userId,
            message: 'Waiting for other leader...',
          });
        }

      } catch (err) {
        console.error('Request next question error:', err);
        socket.emit('error', { message: 'Failed to request next question' });
      }
    });

    // ─────────────────────────────────────────────
    // GAME: SEND CHAT / VOICE / VIDEO IN-GAME
    // ─────────────────────────────────────────────
    socket.on('game:chat', ({ gameId, userId, username, type, content, fileUrl }) => {
      io.to(`game:${gameId}`).emit('game:chat', {
        userId, username, type, content, fileUrl, sentAt: Date.now()
      });
    });

    // ─────────────────────────────────────────────
    // GAME: SEND FRIEND REQUEST TO PLAYER IN GAME
    // ─────────────────────────────────────────────
    socket.on('game:friendRequest', async ({ fromUserId, toUserId }) => {
      // Forward to recipient's personal room
      io.to(`user:${toUserId}`).emit('notification:friendRequest', {
        fromUserId,
        type: 'friend_request',
      });
      // Persist to MongoDB Notification model here via your controller
    });

    // ─────────────────────────────────────────────
    // GAME: PLAYER LEAVES (but game doesn't end)
    // ─────────────────────────────────────────────
    socket.on('game:leave', async ({ gameId, userId }) => {
      await handlePlayerLeave(io, socket, gameId, userId);
    });

    // ─────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      if (!userId) return;

      await R.setUserOffline(userId);

      // If user was in a game, handle their leave
      const userData = await R.getUserOnlineData(userId);
      if (userData?.gameId) {
        await handlePlayerLeave(io, socket, userData.gameId, userId);
      }

      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });

  }); // end io.on('connection')

}; // end registerGameSockets


// ─────────────────────────────────────────────
// INTERNAL: TRY TO MATCH PLAYERS FROM QUEUE
// Handles: quiz, debate (opposing stances), discussion
// Topic categories: entertainment (no level check) vs learning (±5 levels)
// ─────────────────────────────────────────────
async function tryMatch(io, socket, { topic, questionCount, opponentType, playerClass }) {
  const entries = await R.getQueueEntries(topic, questionCount, opponentType, playerClass);
  if (entries.length < 2) return;
  
  // Liberal matching for LEARNING topics: level ±5, class ±2
  // Entertainment topics: NO level/class restrictions
  const canMatch = (p1, p2) => {
    // If entertainment topic, anyone can match
    if (p1.topicCategory === 'entertainment' && p2.topicCategory === 'entertainment') {
      return true;
    }
    
    // For learning topics, apply level/class restrictions
    const levelDiff = Math.abs(parseInt(p1.level) - parseInt(p2.level));
    const classDiff = Math.abs(parseInt(p1.class) - parseInt(p2.class));
    return levelDiff <= 5 && classDiff <= 2;
  };

  // NEW MATCHING LOGIC: opponent type = online member count
  // Team with 3 members wants 'duo' opponent → match with team having 2 members
  const getOnlineMemberCount = (entry) => {
    if (entry.onlineTeamMembers) {
      return entry.onlineTeamMembers.split(',').filter(Boolean).length;
    }
    return 1; // solo player
  };

  const opponentTypeToCount = {
    'solo': 1,
    'duo': 2,
    'trio': 3,
    'squad': 4,
  };

  // Group by game mode
  const quizEntries = entries.filter(e => e.gameMode === 'quiz');
  const debateForEntries = entries.filter(e => e.gameMode === 'debate' && e.stance === 'for');
  const debateAgainstEntries = entries.filter(e => e.gameMode === 'debate' && e.stance === 'against');
  const discussionEntries = entries.filter(e => e.gameMode === 'discussion');

  // ── QUIZ MATCHING ──
  if (quizEntries.length >= 2) {
    for (let i = 0; i < quizEntries.length - 1; i++) {
      for (let j = i + 1; j < quizEntries.length; j++) {
        const e1 = quizEntries[i];
        const e2 = quizEntries[j];
        
        if (!canMatch(e1, e2)) continue;

        // NEW: Match based on actual online member count vs opponent type preference
        const e1Count = getOnlineMemberCount(e1);
        const e2Count = getOnlineMemberCount(e2);
        const e1WantsCount = e1.opponentType === 'default' ? e2Count : opponentTypeToCount[e1.opponentType];
        const e2WantsCount = e2.opponentType === 'default' ? e1Count : opponentTypeToCount[e2.opponentType];

        // Match if e1's count matches what e2 wants AND e2's count matches what e1 wants
        if (e1Count === e2WantsCount && e2Count === e1WantsCount) {
          await matchAndStartGame(io, e1, e2, 'quiz');
          return;
        }
      }
    }
  }

  // ── DEBATE MATCHING (need opposing stances) ──
  if (debateForEntries.length >= 1 && debateAgainstEntries.length >= 1) {
    for (let i = 0; i < debateForEntries.length; i++) {
      for (let j = 0; j < debateAgainstEntries.length; j++) {
        const e1 = debateForEntries[i];
        const e2 = debateAgainstEntries[j];
        
        if (!canMatch(e1, e2)) continue;

        // NEW: Match based on online member count
        const e1Count = getOnlineMemberCount(e1);
        const e2Count = getOnlineMemberCount(e2);
        const e1WantsCount = e1.opponentType === 'default' ? e2Count : opponentTypeToCount[e1.opponentType];
        const e2WantsCount = e2.opponentType === 'default' ? e1Count : opponentTypeToCount[e2.opponentType];

        if (e1Count === e2WantsCount && e2Count === e1WantsCount) {
          await matchAndStartGame(io, e1, e2, 'debate');
          return;
        }
      }
    }
  }

  // ── DISCUSSION MATCHING (no opponent type, just group people) ──
  if (discussionEntries.length >= 2) {
    for (let i = 0; i < discussionEntries.length - 1; i++) {
      for (let j = i + 1; j < discussionEntries.length; j++) {
        if (canMatch(discussionEntries[i], discussionEntries[j])) {
          await matchAndStartGame(io, discussionEntries[i], discussionEntries[j], 'discussion');
          return;
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// HELPER: Match found, remove from queue and start game
// ─────────────────────────────────────────────
async function matchAndStartGame(io, entry1, entry2, gameMode) {
  // Remove both from queue
  await Promise.all([
    R.removeFromQueue(entry1.userId, entry1.topic, entry1.questionCount, entry1.opponentType, entry1.playerClass),
    R.removeFromQueue(entry2.userId, entry2.topic, entry2.questionCount, entry2.opponentType, entry2.playerClass),
  ]);

  await createAndStartGame(io, [entry1], [entry2], entry1.topic, entry1.questionCount, gameMode);
}

// ─────────────────────────────────────────────
// HELPER: Create game session and notify players
// ─────────────────────────────────────────────
async function createAndStartGame(io, teamAEntries, teamBEntries, topic, questionCount, gameMode) {
  const gameId = uuid();

  // Get actual online members
  const getOnlineMembers = (entries) => {
    if (entries[0].onlineTeamMembers) {
      return entries[0].onlineTeamMembers.split(',').filter(Boolean);
    } else {
      return [entries[0].userId];
    }
  };

  const teamAOnlineMembers = getOnlineMembers(teamAEntries);
  const teamBOnlineMembers = getOnlineMembers(teamBEntries);

  // For DISCUSSION mode: NO teamA/teamB division, just merge everyone into one group
  if (gameMode === 'discussion') {
    const allMembers = [...teamAOnlineMembers, ...teamBOnlineMembers];
    
    await R.createGameSession({
      gameId,
      topic,
      totalQuestions: parseInt(questionCount || 0),
      mode: 'discussion',  // Special mode
      gameMode: 'discussion',
      teamAId: null,  // NO teams
      teamBId: null,
      teamAMembers: allMembers,  // All in one group
      teamBMembers: [],
      teamAStance: null,
      teamBStance: null,
    });

    // Store leader IDs (from both original entries)
    const leaderIds = [teamAEntries[0].userId, teamBEntries[0].userId];
    await R.setDiscussionLeaders(gameId, leaderIds);

    // Generate first AI question
    await generateDiscussionQuestion(gameId, topic, 1);
    await R.updateGameSession(gameId, { currentQuestionNumber: 1 });

    // Notify all players
    const matchData = {
      gameId,
      gameMode: 'discussion',
      allMembers,  // Everyone together
      leaderIds,   // Who can click "Next"
      topic,
      totalQuestions: questionCount || 0,
    };

    [...teamAEntries, ...teamBEntries].forEach(e => {
      io.to(`user:${e.userId}`).emit('match:found', matchData);
    });

    // Start 30s greet phase
    await R.startGreetTimer(gameId);
    io.to(`game:${gameId}`).emit('game:greetPhase', { duration: 30, gameId, gameMode: 'discussion' });
    return;
  }

  // For QUIZ and DEBATE: Normal teamA vs teamB logic
  let teamAId, teamBId;
  
  if (teamAEntries[0].teamId) {
    teamAId = teamAEntries[0].teamId;
  } else {
    teamAId = `solo_${teamAEntries[0].userId}`;
  }

  if (teamBEntries[0].teamId) {
    teamBId = teamBEntries[0].teamId;
  } else {
    teamBId = `solo_${teamBEntries[0].userId}`;
  }

  const mode = teamAEntries.length === 1 && teamBEntries.length === 1 ? 'solo' : 'team';
  const firstTeam = Math.random() < 0.5 ? 'teamA' : 'teamB';

  // Create game session with ONLINE members only
  await R.createGameSession({
    gameId,
    topic,
    totalQuestions: parseInt(questionCount || 0),
    mode,
    gameMode,
    teamAId,
    teamBId,
    teamAMembers: teamAOnlineMembers,
    teamBMembers: teamBOnlineMembers,
    teamAStance: teamAEntries[0].stance || null,
    teamBStance: teamBEntries[0].stance || null,
  });

  await R.updateGameSession(gameId, { currentTeam: firstTeam });

  // For quiz and debate: assign turn orders (ONLY ONLINE MEMBERS)
  if (gameMode === 'quiz' || gameMode === 'debate') {
    const teamATurn = shuffle(teamAOnlineMembers);
    const teamBTurn = shuffle(teamBOnlineMembers);
    await R.setTurnOrder(gameId, 'teamA', teamATurn);
    await R.setTurnOrder(gameId, 'teamB', teamBTurn);
  }

  // Notify all matched players
  const matchData = {
    gameId,
    gameMode,
    teamA: teamAEntries,
    teamB: teamBEntries,
    teamAOnlineMembers,
    teamBOnlineMembers,
    teamATurn: gameMode !== 'discussion' ? await R.getTurnOrder(gameId, 'teamA') : [],
    teamBTurn: gameMode !== 'discussion' ? await R.getTurnOrder(gameId, 'teamB') : [],
    firstTeam: gameMode !== 'discussion' ? firstTeam : null,
    topic,
    totalQuestions: questionCount || 0,
    teamAStance: teamAEntries[0].stance || null,
    teamBStance: teamBEntries[0].stance || null,
  };

  [...teamAEntries, ...teamBEntries].forEach(e => {
    io.to(`user:${e.userId}`).emit('match:found', matchData);
  });

  // Start 30s greet phase (all modes)
  await R.startGreetTimer(gameId);
  io.to(`game:${gameId}`).emit('game:greetPhase', { duration: 30, gameId, gameMode });
}

// ─────────────────────────────────────────────
// HELPER: Generate AI discussion question
// ─────────────────────────────────────────────
async function generateDiscussionQuestion(gameId, topic, questionNumber) {
  // TODO: Call OpenAI to generate question based on topic
  // For now, placeholder
  const aiQuestion = `Discussion Question ${questionNumber}: What are your thoughts on ${topic}?`;
  
  await R.setDiscussionQuestion(gameId, questionNumber, aiQuestion);
  return aiQuestion;
}

// ─────────────────────────────────────────────
// INTERNAL: PROCEED TO NEXT TURN
// ─────────────────────────────────────────────
async function proceedToNextTurn(io, gameId) {
  const { questionsAsked, totalQuestions } = await R.advanceTurn(gameId);

  if (parseInt(questionsAsked) >= parseInt(totalQuestions)) {
    // Game over!
    await endGame(io, gameId);
    return;
  }

  const nextAsker = await R.getCurrentAsker(gameId);
  const session = await R.getGameSession(gameId);

  io.to(`game:${gameId}`).emit('game:nextTurn', {
    nextAsker,
    currentTeam: session.currentTeam,
    questionsAsked,
    totalQuestions,
  });

  // Start 15s ask timer for next player
  await R.startAskTimer(gameId);
  io.to(`game:${gameId}`).emit('game:askTimer', { askerId: nextAsker, duration: 15 });
}

// ─────────────────────────────────────────────
// INTERNAL: END GAME
// ─────────────────────────────────────────────
async function endGame(io, gameId) {
  const scores = await R.getTeamScores(gameId);
  const playerScores = await R.getPlayerScores(gameId);
  const session = await R.getGameSession(gameId);

  const teamAScore = parseInt(scores.teamA || 0);
  const teamBScore = parseInt(scores.teamB || 0);

  // Get member lists before they're cleared
  const teamAMembers = session.teamAMembers ? session.teamAMembers.split(',') : [];
  const teamBMembers = session.teamBMembers ? session.teamBMembers.split(',') : [];

  let result;
  if (teamAScore > teamBScore) result = 'teamA';
  else if (teamBScore > teamAScore) result = 'teamB';
  else result = 'draw';

  // Find MVP (highest individual score)
  let mvp = null, mvpScore = -1;
  Object.entries(playerScores).forEach(([uid, score]) => {
    if (parseInt(score) > mvpScore) {
      mvpScore = parseInt(score);
      mvp = uid;
    }
  });

  await R.endGameSession(gameId);

  io.to(`game:${gameId}`).emit('game:ended', {
    result,
    teamAScore,
    teamBScore,
    playerScores,
    mvp,
    session,
  });

  // Clear currentTeam for all players
  const allPlayers = [...teamAMembers, ...teamBMembers];
  await Promise.all(
    allPlayers.map(userId => User.findByIdAndUpdate(userId, { currentTeam: null }))
  );

  // Save completed game to MongoDB
  await saveCompletedGame(gameId);
}

// ─────────────────────────────────────────────
// INTERNAL: HANDLE PLAYER LEAVE
// ─────────────────────────────────────────────
async function handlePlayerLeave(io, socket, gameId, userId) {
  socket.leave(`game:${gameId}`);
  await R.removePlayerFromGame(gameId, userId);
  await R.setUserOffline(userId);

  // Clear currentTeam when leaving game
  await User.findByIdAndUpdate(userId, { currentTeam: null });

  io.to(`game:${gameId}`).emit('game:playerLeft', { userId });

  // Only end/cleanup Redis if everyone has left
  const isEmpty = await R.isGameEmpty(gameId);
  if (isEmpty) {
    await R.deleteGameSession(gameId);
    console.log(`🗑️  Game ${gameId} cleaned up from Redis`);
  }
}

// ─────────────────────────────────────────────
// INTERNAL: HANDLE TIMER EXPIRY (Redis keyspace events)
// ─────────────────────────────────────────────
async function handleTimerExpiry(io, expiredKey) {
  try {

    // ── Greet phase ended → start game ──
    if (expiredKey.includes(':timer:greet')) {
      const gameId = expiredKey.split(':')[1];
      await R.updateGameSession(gameId, { status: 'active' });

      const nextAsker = await R.getCurrentAsker(gameId);
      const session = await R.getGameSession(gameId);

      io.to(`game:${gameId}`).emit('game:started', {
        message: 'Game begins!',
        firstAsker: nextAsker,
        currentTeam: session.currentTeam,
      });

      await R.startAskTimer(gameId);
      io.to(`game:${gameId}`).emit('game:askTimer', { askerId: nextAsker, duration: 15 });
    }

    // ── Ask timer expired → player didn't ask, penalize (questions remaining -1) ──
    else if (expiredKey.includes(':timer:ask')) {
      const gameId = expiredKey.split(':')[1];
      io.to(`game:${gameId}`).emit('game:askTimerExpired', { message: 'Question skipped!' });
      await proceedToNextTurn(io, gameId);
    }

    // ── Pin window ended → check raised hands ──
    else if (expiredKey.includes(':timer:pin')) {
      const gameId = expiredKey.split(':')[1];
      const hands = await R.getAllRaisedHands(gameId);

      if (!hands.length) {
        // Nobody raised hand → Condition A: asker must answer their own Q
        const question = await R.getCurrentQuestion(gameId);
        io.to(`game:${gameId}`).emit('game:noHandsRaised', { askerId: question.askedBy });
        await R.startAskerAnsTimer(gameId);
        io.to(`game:${gameId}`).emit('game:askerMustAnswer', { askerId: question.askedBy, duration: 15 });

      } else if (hands.length === 2) {
        // Exactly one person → they get to answer
        const selectedUserId = hands[0]; // index 0 = userId (WITHSCORES alternates user/score)
        io.to(`game:${gameId}`).emit('game:answererSelected', { userId: selectedUserId });
        await R.startAnswerTimer(gameId);
        io.to(`game:${gameId}`).emit('game:answerTimer', { answererId: selectedUserId, duration: 15 });

      } else {
        // Multiple hands raised at same time → check if same timestamp
        const firstTime = hands[1]; // score of first entry
        const sameTimeHands = [];
        for (let i = 0; i < hands.length; i += 2) {
          if (hands[i + 1] === firstTime) sameTimeHands.push(hands[i]);
        }

        if (sameTimeHands.length > 1) {
          // Tied! Give team 10s to discuss and lower hands
          io.to(`game:${gameId}`).emit('game:handTie', { tiedUsers: sameTimeHands, duration: 10 });
          await R.startDiscussTimer(gameId);
        } else {
          // Clear winner by time
          const selectedUserId = hands[0];
          io.to(`game:${gameId}`).emit('game:answererSelected', { userId: selectedUserId });
          await R.startAnswerTimer(gameId);
          io.to(`game:${gameId}`).emit('game:answerTimer', { answererId: selectedUserId, duration: 15 });
        }
      }
    }

    // ── Answer timer expired → wrong/no answer → Condition A ──
    else if (expiredKey.includes(':timer:answer')) {
      const gameId = expiredKey.split(':')[1];
      const question = await R.getCurrentQuestion(gameId);
      io.to(`game:${gameId}`).emit('game:answerTimerExpired');
      await R.startAskerAnsTimer(gameId);
      io.to(`game:${gameId}`).emit('game:askerMustAnswer', { askerId: question.askedBy, duration: 15 });
    }

    // ── Asker answer timer expired → no one gets point ──
    else if (expiredKey.includes(':timer:askerAns')) {
      const gameId = expiredKey.split(':')[1];
      io.to(`game:${gameId}`).emit('game:conditionAResult', {
        isCorrect: false,
        timedOut: true,
        scores: await R.getTeamScores(gameId),
      });
      await R.clearRaisedHands(gameId);
      await proceedToNextTurn(io, gameId);
    }

    // ── Discussion timer expired → randomly pick from raised hands ──
    else if (expiredKey.includes(':timer:discuss')) {
      const gameId = expiredKey.split(':')[1];
      const hands = await R.getAllRaisedHands(gameId);
      if (!hands.length) {
        await proceedToNextTurn(io, gameId);
        return;
      }
      // Pick random from remaining raised hands
      const userIds = hands.filter((_, i) => i % 2 === 0);
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      io.to(`game:${gameId}`).emit('game:answererSelected', { userId: randomUserId, wasRandom: true });
      await R.startAnswerTimer(gameId);
      io.to(`game:${gameId}`).emit('game:answerTimer', { answererId: randomUserId, duration: 15 });
    }

  } catch (err) {
    console.error('Timer expiry error:', err);
  }
}