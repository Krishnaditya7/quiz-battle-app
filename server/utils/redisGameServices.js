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
    playerClass, teamId, onlineTeamMembers 
  } = queueData;
  
  const queueKey = K.matchQueue(topic, questionCount);
  // Store full entry data
  await redis.hset(K.queueEntry(userId), {
    userId,
    username,
    level,
    topic,
    questionCount,
    playerCount,
    opponentType,
    playerClass,
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

export const removeFromQueue = async (userId, topic, questionCount) => {
  const queueKey = K.matchQueue(topic, questionCount);
  await redis.lrem(queueKey, 0, userId);
  await redis.del(K.queueEntry(userId));
};

export const getQueueLength = async (topic, questionCount) => {
  return await redis.llen(K.matchQueue(topic, questionCount));
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

export const getQueueEntries = async (topic, questionCount) => {
  const queueKey = K.matchQueue(topic, questionCount);
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
  gameId, topic, totalQuestions,
  teamAMembers, teamBMembers,currentTeam, // arrays of userId strings
  questionsAsked, status
}) => {
  await redis.hset(K.gameSession(gameId), {
    gameId,
    topic,
    totalQuestions,
    teamAMembers: teamAMembers.join(','),  // ← FIXED: store as comma-separated
    teamBMembers: teamBMembers.join(','),  // ← FIXED
    currentTeam, 
    questionsAsked,
    status,
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
export const getGameRatings = async (gameId) => {
  const ratingKey = `game:${gameId}:ratings`;
  const raw = await redis.lrange(ratingKey, 0, -1);
  return raw.map(r => {
    try { return JSON.parse(r); }
    catch { return null; }
  }).filter(Boolean);
};

export const deleteGameRatings = async (gameId) => {
  await redis.del(`game:${gameId}:ratings`);
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
    K.activePlayers(gameId),
    K.playerSockets(gameId),
  );
};


// ─────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────

export const addPlayerPoint = async (gameId, userId) => {
  return await redis.hincrby(K.playerScores(gameId), userId, 1);
};

export const getPlayerScores = async (gameId) => {
  return await redis.hgetall(K.playerScores(gameId));
};


// Convenience: award point to player AND their team in one call
export const awardPoint = async (gameId, userId) => {
  const playerScore = await Promise.all([
    addPlayerPoint(gameId, userId),
  ]);
  return playerScore
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

// new functions
// Add these functions
export const addNextQuestionVote = async (gameId, userId) => {
  await redis.sadd(`game:${gameId}:votes:next`, userId);
  await redis.expire(`game:${gameId}:votes:next`, 3600);
};

export const getNextQuestionVotes = async (gameId) => {
  return await redis.smembers(`game:${gameId}:votes:next`);
};

export const clearNextQuestionVotes = async (gameId) => {
  await redis.del(`game:${gameId}:votes:next`);
};

export const setCurrentQuestionNumber = async (gameId, num) => {
  await redis.hset(`game:${gameId}:session`, 'currentQuestionNumber', num);
};

export const setDiscussionQuestion = async (gameId, questionNum, question) => {
  await redis.set(`game:${gameId}:dq:${questionNum}`, question, 'EX', 7200);
};

export const getDiscussionQuestion = async (gameId, questionNum) => {
  return await redis.get(`game:${gameId}:dq:${questionNum}`);
};
export const setGameStatus = async (gameId, status) => {
  await redis.hset(K.gameSession(gameId), 'status', status);
};
export const removeActivePlayer = async (gameId, userId) => {
  await redis.srem(K.activePlayers(gameId), userId);
};


export const setUserOffGame = async (userId) => {
  await redis.hset(`user:${userId}:online`, 'isInGame', 'false');
  await redis.hdel(`user:${userId}:online`, 'gameId');
};