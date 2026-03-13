// ============================================================
// REDIS GAME SERVICE
// All Redis read/write operations for live game management.
// Used by: gameController.js + socket handlers
// ============================================================

import redis from '../config/redis.js';
import K from '../config/redisKeys.js';
import { v4 as uuid } from 'uuid';
import User from '../models/Users.js';

// ─────────────────────────────────────────────
// USER PRESENCE
// ─────────────────────────────────────────────

export const setUserOnline = async (userId, socketId, username, level) => {
  await redis.hset(K.userOnline(userId), {
    socketId,
    username,
    level,
    isInGame: 'false',
  });
  await redis.expire(K.userOnline(userId), 60 * 60 * 2); // 2 hours TTL
};

export const setUserOffline = async (userId) => {
  await redis.del(K.userOnline(userId));
};

export const setUserInGame = async (userId, gameId) => {
  await redis.hset(K.userOnline(userId), { isInGame: 'true', gameId });
  await redis.expire(K.userOnline(userId), 60 * 60 * 2);
};

export const getUserOnlineData = async (userId) => {
  return await redis.hgetall(K.userOnline(userId));
};

export const isUserOnline = async (userId) => {
  return await redis.exists(K.userOnline(userId));
};

// ─────────────────────────────────────────────
// MATCHMAKING QUEUE
// ─────────────────────────────────────────────

export const addToQueue = async (userId, queueData) => {
  const { 
    username, level, topic, questionCount, playerCount, opponentType, 
    gameMode, stance, playerClass, teamId, onlineTeamMembers 
  } = queueData;
  
  const queueKey = K.matchQueue(topic, questionCount, gameMode);
  // Store full entry data
  await redis.hset(K.queueEntry(userId), {
    userId,
    username,
    level,
    topic,
    questionCount,
    playerCount,
    opponentType,
    gameMode,
    stance: stance || '',
    class: playerClass,
    teamId: teamId || '',
    onlineTeamMembers,
    joinedAt: Date.now(),
  });
  await redis.expire(K.queueEntry(userId), 180); // 3 min queue timeout

  // Push userId into the right queue
  await redis.lpush(queueKey, userId);
  await redis.expire(queueKey, 180);

  return queueKey;
};

export const removeFromQueue = async (userId, topic, questionCount, gameMode) => {
  const queueKey = K.matchQueue(topic, questionCount, gameMode);
  await redis.lrem(queueKey, 0, userId);
  await redis.del(K.queueEntry(userId));
};

export const getQueueLength = async (topic, questionCount, gameMode) => {
  return await redis.llen(K.matchQueue(topic, questionCount, gameMode));
};
export const getAllQueueEntriesForTopic = async (topic) => {
  // Get all queue keys matching this topic
  const pattern = `queue:${topic}:*`;
  const queueKeys = await redis.keys(pattern);
  
  const allEntries = [];
  
  for (const queueKey of queueKeys) {
    // Get all userIds in this queue
    const userIds = await redis.lrange(queueKey, 0, -1);
    
    for (const userId of userIds) {
      const entryData = await redis.hgetall(K.queueEntry(userId));
      if (entryData && entryData.userId) {
        allEntries.push(entryData);
      }
    }
  }
  
  return allEntries;
};

export const getQueueEntries = async (topic, questionCount, gameMode) => {
  const queueKey = K.matchQueue(topic, questionCount, gameMode);
  const userIds = await redis.lrange(queueKey, 0, -1); // Get all userIds in this queue
  if (!userIds.length) return [];

  const entries = await Promise.all(
    userIds.map(id => redis.hgetall(K.queueEntry(id)))
  );
  return entries.filter(Boolean);
};

// Get a single user's queue entry (to check if they're queued)
export const getUserQueueEntry = async (userId) => {
  const data = await redis.hgetall(K.queueEntry(userId));
  return data && data.userId ? data : null;
};

// ─────────────────────────────────────────────
// TEMPORARY TEAM (solo players grouped for duo/trio/squad)
// ─────────────────────────────────────────────

export const createTempTeam = async (topic, questionCount, opponentType, playerCount) => {
  const tempTeamId = uuid();
  await redis.hset(K.tempTeam(tempTeamId), {
    tempTeamId,
    members: JSON.stringify(members), // array of { userId, username, level }
    topic,
    questionCount,
    createdAt: Date.now(),
  });
  await redis.expire(K.tempTeam(tempTeamId), 600); // 10 min TTL
  return tempTeamId;
};

export const getTempTeam = async (tempTeamId) => {
  const data = await redis.hgetall(K.tempTeam(tempTeamId));
  if (!data || !data.members) return null;
  data.members = JSON.parse(data.members);
  return data;
};

export const deleteTempTeam = async (tempTeamId) => {
  await redis.del(K.tempTeam(tempTeamId));
};

// ─────────────────────────────────────────────
// GAME SESSION
// ─────────────────────────────────────────────

export const createGameSession = async ({
  gameId, topic, totalQuestions, mode,
  gameMode,
  teamAId, teamBId,
  teamAMembers, teamBMembers, // arrays of userId strings
  teamAStance, teamBStance,
}) => {
  await redis.hset(K.gameSession(gameId), {
    gameId,
    topic,
    totalQuestions,
    questionsAsked: 0,
    status: 'greet',       // greet → active → done
    mode,
    gameMode: gameMode || 'quiz',
    teamAId,
    teamBId,
    teamAMembers: teamAMembers.join(','),  // ← FIXED: store as comma-separated
    teamBMembers: teamBMembers.join(','),  // ← FIXED
    teamAStance: teamAStance || '',
    teamBStance: teamBStance || '',
    currentTeam: 'teamA',  // teamA goes first (set after random pick)
    currentTurnIndex: 0,
    teamAScore: 0,
    teamBScore: 0,
    startedAt: Date.now(),
  });
  await redis.expire(K.gameSession(gameId), 60 * 60 * 2); // 2 hour max

  // Store all active players
  const allPlayers = [...teamAMembers, ...teamBMembers];
  if (allPlayers.length) {
    await redis.sadd(K.activePlayers(gameId), ...allPlayers);
    await redis.expire(K.activePlayers(gameId), 60 * 60 * 2);
  }
};

export const getGameSession = async (gameId) => {
  return await redis.hgetall(K.gameSession(gameId));
};

export const updateGameSession = async (gameId, fields) => {
  await redis.hset(K.gameSession(gameId), fields);
};

export const endGameSession = async (gameId) => {
  // Mark done (don't delete yet — let goodbye phase finish)
  await redis.hset(K.gameSession(gameId), { status: 'done' });
  // Schedule cleanup after 5 min
  await redis.expire(K.gameSession(gameId), 300);
};

export const deleteGameSession = async (gameId) => {
  const game = await getGameSession(gameId);
  if (!game) return;

  await redis.del(
    K.gameSession(gameId),
    K.teamTurnOrder(gameId, 'teamA'),
    K.teamTurnOrder(gameId, 'teamB'),
    K.currentAsker(gameId),
    K.currentQuestion(gameId),
    K.raisedHands(gameId),
    K.playerScores(gameId),
    K.teamScores(gameId),
    K.activePlayers(gameId),
    K.playerSockets(gameId),
    K.timerAskQuestion(gameId),
    K.timerPinWindow(gameId),
    K.timerAnswer(gameId),
    K.timerAskerAnswer(gameId),
    K.timerDiscussion(gameId),
  );
};

// ─────────────────────────────────────────────
// TURN ORDER
// ─────────────────────────────────────────────

export const setTurnOrder = async (gameId, teamKey, orderedUserIds) => {
  // teamKey = 'teamA' or 'teamB'
  const key = K.teamTurnOrder(gameId, teamKey);
  if (orderedUserIds.length) {
    await redis.rpush(key, ...orderedUserIds);
    await redis.expire(key, 60 * 60 * 2);
  }
};

export const getTurnOrder = async (gameId, teamKey) => {
  return await redis.lrange(K.teamTurnOrder(gameId, teamKey), 0, -1);
};

// Get the current asker's userId based on currentTeam + currentTurnIndex
export const getCurrentAsker = async (gameId) => {
  const session = await getGameSession(gameId);
  const { currentTeam, currentTurnIndex } = session;
  const order = await getTurnOrder(gameId, currentTeam);
  return order[parseInt(currentTurnIndex)] || null;
};

// Advance to next turn (alternates teams, advances turn index within team)
export const advanceTurn = async (gameId) => {
  const session = await getGameSession(gameId);
  let { currentTeam, currentTurnIndex, totalQuestions, questionsAsked } = session;
  currentTurnIndex = parseInt(currentTurnIndex);
  questionsAsked = parseInt(questionsAsked) + 1;

  const teamAOrder = await getTurnOrder(gameId, 'teamA');
  const teamBOrder = await getTurnOrder(gameId, 'teamB');

  // Alternate teams
  const nextTeam = currentTeam === 'teamA' ? 'teamB' : 'teamA';
  const nextOrder = nextTeam === 'teamA' ? teamAOrder : teamBOrder;

  // Advance turn index only when we've gone through both teams once
  let nextTurnIndex = currentTurnIndex;
  if (nextTeam === 'teamA') {
    nextTurnIndex = (currentTurnIndex + 1) % nextOrder.length;
  }

  await updateGameSession(gameId, {
    currentTeam: nextTeam,
    currentTurnIndex: nextTurnIndex,
    questionsAsked,
  });

  return { questionsAsked, totalQuestions: parseInt(totalQuestions) };
};

// ─────────────────────────────────────────────
// CURRENT QUESTION
// ─────────────────────────────────────────────

export const setCurrentQuestion = async (gameId, { question, askedBy, askedByTeam, translatedQuestion = '' }) => {
  await redis.hset(K.currentQuestion(gameId), {
    question,
    translatedQuestion,
    askedBy,
    askedByTeam,
    pinnedAt: '',
    correctAnswer: '',
    answeredBy: '',
    givenAnswer: '',
    status: 'asking',
  });
  await redis.expire(K.currentQuestion(gameId), 60); // safety TTL
};

export const pinQuestion = async (gameId, translatedQuestion) => {
  await redis.hset(K.currentQuestion(gameId), {
    translatedQuestion,
    pinnedAt: Date.now(),
    status: 'pinned',
  });
};

export const setCorrectAnswer = async (gameId, correctAnswer) => {
  await redis.hset(K.currentQuestion(gameId), { correctAnswer });
};

export const setQuestionAnswered = async (gameId, answeredBy, givenAnswer, isCorrect) => {
  await redis.hset(K.currentQuestion(gameId), {
    answeredBy,
    givenAnswer,
    isCorrect: isCorrect ? 'true' : 'false',
    status: 'done',
  });
};

export const getCurrentQuestion = async (gameId) => {
  return await redis.hgetall(K.currentQuestion(gameId));
};

// ─────────────────────────────────────────────
// HAND RAISING (Sorted Set — score = timestamp)
// ─────────────────────────────────────────────

export const raiseHand = async (gameId, userId) => {
  const now = Date.now();
  await redis.zadd(K.raisedHands(gameId), now, userId);
  await redis.expire(K.raisedHands(gameId), 30);
  return now;
};

export const lowerHand = async (gameId, userId) => {
  await redis.zrem(K.raisedHands(gameId), userId);
};

export const getAllRaisedHands = async (gameId) => {
  // Returns [ userId, timestamp, userId, timestamp ] sorted earliest first
  return await redis.zrange(K.raisedHands(gameId), 0, -1, 'WITHSCORES');
};

export const getFirstHandRaised = async (gameId) => {
  // Returns the userId who raised hand first (lowest timestamp)
  const result = await redis.zrange(K.raisedHands(gameId), 0, 0, 'WITHSCORES');
  if (!result.length) return null;
  return { userId: result[0], raisedAt: result[1] };
};

export const clearRaisedHands = async (gameId) => {
  await redis.del(K.raisedHands(gameId));
};

// ─────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────

export const addPlayerPoint = async (gameId, userId) => {
  return await redis.hincrby(K.playerScores(gameId), userId, 1);
};

export const addTeamPoint = async (gameId, teamKey) => {
  // teamKey = 'teamA' or 'teamB'
  return await redis.hincrby(K.teamScores(gameId), teamKey, 1);
};
export const setTeamScore = async (gameId, teamKey, score) => {
    await redis.hset(K.teamScores(gameId), teamKey, score);
};
export const getPlayerScores = async (gameId) => {
  return await redis.hgetall(K.playerScores(gameId));
};

export const getTeamScores = async (gameId) => {
  return await redis.hgetall(K.teamScores(gameId));
};

// Convenience: award point to player AND their team in one call
export const awardPoint = async (gameId, userId, teamKey) => {
  const [playerScore, teamScore] = await Promise.all([
    addPlayerPoint(gameId, userId),
    addTeamPoint(gameId, teamKey),
  ]);
  return { playerScore, teamScore };
};

// ─────────────────────────────────────────────
// TIMERS  (key existence = timer running; expiry = timer ended)
// Socket.IO keyspace expiry events will trigger next game phase
// ─────────────────────────────────────────────

export const startTimer = async (timerKey, seconds) => {
  await redis.set(timerKey, '1', 'EX', seconds);
};

export const cancelTimer = async (timerKey) => {
  await redis.del(timerKey);
};

export const startGreetTimer   = (gameId) => startTimer(K.timerGreet(gameId), 30);
export const startAskTimer     = (gameId) => startTimer(K.timerAskQuestion(gameId), 15);
export const startPinTimer     = (gameId) => startTimer(K.timerPinWindow(gameId), 10);
export const startAnswerTimer  = (gameId) => startTimer(K.timerAnswer(gameId), 15);
export const startAskerAnsTimer= (gameId) => startTimer(K.timerAskerAnswer(gameId), 15);
export const startDiscussTimer = (gameId) => startTimer(K.timerDiscussion(gameId), 10);

// ─────────────────────────────────────────────
// ACTIVE PLAYERS IN GAME
// ─────────────────────────────────────────────

export const registerPlayerSocket = async (gameId, userId, socketId) => {
  await redis.hset(K.playerSockets(gameId), userId, socketId);
  await redis.expire(K.playerSockets(gameId), 60 * 60 * 2);
};

export const removePlayerFromGame = async (gameId, userId) => {
  await redis.srem(K.activePlayers(gameId), userId);
  await redis.hdel(K.playerSockets(gameId), userId);
};

export const getActivePlayers = async (gameId) => {
  return await redis.smembers(K.activePlayers(gameId));
};

export const getActivePlayerCount = async (gameId) => {
  return await redis.scard(K.activePlayers(gameId));
};

export const isGameEmpty = async (gameId) => {
  const count = await getActivePlayerCount(gameId);
  return count === 0;
};

// ─────────────────────────────────────────────
// AI ANSWER CACHE
// ─────────────────────────────────────────────

export const cacheAIAnswer = async (gameId, questionHash, answer) => {
  await redis.set(K.aiAnswer(gameId, questionHash), answer, 'EX', 300); // 5 min TTL
};

export const getCachedAIAnswer = async (gameId, questionHash) => {
  return await redis.get(K.aiAnswer(gameId, questionHash));
};

// ─────────────────────────────────────────────
// CHALLENGE REQUESTS
// ─────────────────────────────────────────────

export const createChallengeRequest = async ({ fromUserId, toId, topic, questionCount, opponentType }) => {
  const challengeId = uuid();
  await redis.hset(K.challengeRequest(challengeId), {
    challengeId,
    fromUserId,
    toId,
    topic,
    questionCount,
    opponentType,
    status: 'pending',
    createdAt: Date.now(),
  });
  await redis.expire(K.challengeRequest(challengeId), 120); // 2 min to respond
  return challengeId;
};

export const getChallengeRequest = async (challengeId) => {
  return await redis.hgetall(K.challengeRequest(challengeId));
};

export const updateChallengeStatus = async (challengeId, status) => {
  await redis.hset(K.challengeRequest(challengeId), { status });
};

export const deleteChallengeRequest = async (challengeId) => {
  await redis.del(K.challengeRequest(challengeId));
};

// ─────────────────────────────────────────────
// DEBATE POINTS
// ─────────────────────────────────────────────

export const addDebatePoint = async (gameId, userId, team, point, turnNumber) => {
  const pointData = JSON.stringify({ 
    userId, 
    team, 
    point, 
    turnNumber,
    timestamp: Date.now() 
  });
  await redis.rpush(K.debatePoints(gameId), pointData);
  await redis.expire(K.debatePoints(gameId), 60 * 60 * 2);
};

export const getDebatePoints = async (gameId) => {
  const points = await redis.lrange(K.debatePoints(gameId), 0, -1);
  return points.map(p => JSON.parse(p));
};

export const startDebatePointTimer = (gameId) => startTimer(K.timerDebatePoint(gameId), 300); // 5 min

// ─────────────────────────────────────────────
// QUIZ QUESTION HISTORY
// ─────────────────────────────────────────────

export const addQuestionToHistory = async (gameId, questionData) => {
  // questionData: { askedBy, askedByTeam, question, translatedQuestion, correctAnswer, answeredBy, answeredByTeam, givenAnswer, isCorrect }
  const data = JSON.stringify({ ...questionData, timestamp: Date.now() });
  await redis.rpush(K.questionHistory(gameId), data);
  await redis.expire(K.questionHistory(gameId), 60 * 60 * 2);
};

export const getQuestionHistory = async (gameId) => {
  const questions = await redis.lrange(K.questionHistory(gameId), 0, -1);
  return questions.map(q => JSON.parse(q));
};

// ─────────────────────────────────────────────
// DISCUSSION MODE - AI QUESTIONS & LEADER READY
// ─────────────────────────────────────────────

export const setDiscussionQuestion = async (gameId, questionNumber, question) => {
  await redis.hset(`game:${gameId}:discussionQuestion`, {
    questionNumber,
    question,
    timestamp: Date.now(),
  });
  await redis.expire(`game:${gameId}:discussionQuestion`, 60 * 60 * 2);
};

export const getDiscussionQuestion = async (gameId) => {
  return await redis.hgetall(`game:${gameId}:discussionQuestion`);
};

export const isDiscussionLeader = async (gameId, userId) => {
  const leaders = await redis.smembers(`game:${gameId}:leaders`);
  return leaders.includes(userId);
};

export const setDiscussionLeaders = async (gameId, leaderIds) => {
  if (leaderIds.length > 0) {
    await redis.sadd(`game:${gameId}:leaders`, ...leaderIds);
    await redis.expire(`game:${gameId}:leaders`, 60 * 60 * 2);
  }
};

export const markLeaderReadyForNext = async (gameId, userId) => {
  await redis.sadd(`game:${gameId}:leadersReady`, userId);
  await redis.expire(`game:${gameId}:leadersReady`, 60);
};

export const areBothLeadersReady = async (gameId) => {
  const readyCount = await redis.scard(`game:${gameId}:leadersReady`);
  const totalLeaders = await redis.scard(`game:${gameId}:leaders`);
  return readyCount === totalLeaders && totalLeaders > 0;
};

export const clearLeaderReadyStates = async (gameId) => {
  await redis.del(`game:${gameId}:leadersReady`);
};