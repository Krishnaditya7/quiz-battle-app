//these codes will be used by gameControllers for better performance
import { useId } from "react";
import redis from "../config/Redis";
import K from "../config/redisKeys";
import { v4 as uuid } from 'uuid';

//User ki PRESENCE ki baat
//  ------------------------------------------------------------------------------------
export const setUserOnline = async (userId, socketId, username, level) => {
    await redis.hset(K.userOnline(userId), {
        socketId,
        username,
        level,
        isInGame: 'false',
    });
    await redis.expire(K.userOnline(userId), 60*60*2)
    //aisa hai ki koi cheez setUserOnline ko activate kregi then username,level wagerah bhi aagya even after the fact ki
    //it is stored in mongo...because player aagya...khelne ki mansha se to cache rakho na uski values taaki woh jaldi 
    //matchmaking kr paaye
};
export const setUserOffline = async(userId) => {
    await redis.del(K.userOnline(userId));
};

export const setUserInGame = async (userId, gameId) => {
    await redis.hset(K.userOnline(userId), { isInGame: 'true', gameId });
    await redis.expire(K.userOnline(userId), 60*60*2);
    /*✅ In Redis → YES
❌ In your JavaScript model → Not necessarily

Important:

Redis is schema-less.

There is no predefined structure like MongoDB schema.

When you do:

redis.hset(key, { isInGame: 'true' })


If isInGame field didn’t exist before →
Redis simply creates it.

If it already existed →
Redis updates it.*/
};

export const getUserOnlineData = async (userId) => {
    return await redis.hgetall(K.userOnline(userId));
    // Get all the fields and values in a hash
};

export const isUserOnline = async (userId) => {
    return await redis.exists(K.userOnline(userId));
    /* The EXISTS command in Redis checks for the existence of one or more specified keys in the database. It returns the total count of keys that exist, with a return value of 
 (or higher) indicating existence, and 
 indicating the key does not exist.*/
};
// --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// MatchMaking Queue banana
// ------------------------------------------------------------------------------------------------------------------------------------
export const addToQueue = async (userId,{ username, level, topic, questionCount, opponentType, playerClass, teamId = null}) => {
    const queueKey = K.matchQueue(topic, questionCount, opponentType, playerClass);

    // entry ke datas jisko fulfill krke joining hogi
    await redis.hset(K.queueEntry(userId), {
        userId,
        username,
        level,
        topic,
        questionCount,
        opponentType,
        class: playerClass,
        teamId: teamId || '',
        joinedAt: Date.now(),
    });
    await redis.expire(K.queueEntry(userId),180);

    await redis.lpush(queueKey, userId);
    await redis.expire(queueKey, 180);
    //not being too harsh with levels and making inter-competition, challenge icon sending req with time topic team
 return queueKey;
};
 export const removeFromQueue = async (userId, topic, questionCount, opponentType, playerClass) => {
    const queueKey = K.matchQueue(topic, questionCount, opponentType, playerClass);
    await redis.lrem(queueKey, 0, userId);
    await redis.del(K.queueEntry)
 };

 export const getQueueLength = async (userId, topic, questionCount, opponentType, playerClass) => {
    return await redis.llen(K.matchQueue(topic, questionCount, opponentType, playerClass));
 };
 export const getQueueEntries = async (topic, questionCount, opponentType, playerClass) => {
       const queueKey = K.matchQueue(topic, questionCount, opponentType, playerClass);
       const userIds = await redis.lrange(queueKey, 0, -1);
       if(!userIds.length) return [];

       const entries = await Promise.all(
        userIds.map(id => redis.hgetall(K.queueEntry(id)))
       );
       return entries.filter(Boolean);
 };
 /*We need removeFromQueue because:

✔ Users can cancel
✔ Users can disconnect
✔ Users can get matched
✔ TTL is only backup cleanup
✔ Prevents ghost players
✔ Prevents duplicate matches

Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
*/
/*---------------------------
Ab ek temporary team for Solo but not alone player
---------------------------------------------------------------------*/
export const createTempTeam = async (members, topic, questionCount) => {
    const teamId = uuid();
    await redis.hset(K.tempTeam(tempTeamId),{
        tempTeamId,
        members: JSON.stringify(members), //array of { userId, username, level }
        topic,
        questionCount,
        createdAt : Date.now(),
    });
    await redis.expire(K.tempTeam(tempTeamId), 600); 
    return tempTeamId;
};

export const getTempTeam = async (tempTeamId) => {
    const data = await redis.hgetall(K.tempTeam(tempTeamId));
    if(!data || !data.members) return null;

    data.members= JSON.parse(data.members);
    return data;
};

export const deleteTempTeam = async (teamTeamId) => {
    await redis.del(K.tempTeam(tempTeamId));
};
/*----------------------------------
Game session 
-------------------------------------*/
export const createGameSession = async ({
    gameId, topic, totalQuestions, mode,
    teamAId, teamBId,
    teamAMembers, teamBMembers, // array of userId strings
}) => {
    await redis.hset(K.gameSession(gameId), {
        gameId,
        topic,
        totalQuestions,
        questionsAsked: 0,
        status: 'greet',
        mode,
        teamAId,
        teamBId,
        currentTeam: 'teamA',    //that means team A goes first after random pick
        currentTurnIndex: 0,
        teamAscore: 0,
        teamBScore: 0,
        startedAt: Date.now(),
    });
    await redis.expire(K.gameSession(gameId), 60*60*2);

    const allPlayers = [...teamAMembers, ...teamBMembers];
    if(allPlayers.length){
        await redis.sadd(K.activePlayers(gameId), ...allPlayers);
        await redis.expire(K.activePlayers(gameId), 60*60*2);
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

// ────────────────────
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