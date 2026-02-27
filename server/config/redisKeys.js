// ============================================================
// REDIS KEY FACTORY
// Single source of truth for every Redis key in the game.
// Always use these functions — never hardcode keys elsewhere.
// ============================================================

const K = {

  // ─────────────────────────────────────────────
  // 1. USER PRESENCE
  // ─────────────────────────────────────────────

  // Hash  → { socketId, username, level, isInGame }
  // TTL   → 2 hours (refreshed on activity)
  userOnline: (userId) => `user:${userId}:online`,

  // ─────────────────────────────────────────────
  // 2. MATCHMAKING QUEUES
  // Each queue is a Redis List (LPUSH to add, BRPOP to match)
  // Key format: queue:{topic}:{questionCount}:{opponentType}:{class}
  // opponentType = solo | duo | trio | squad | default
  // ─────────────────────────────────────────────

  // List  → [ userId, userId, ... ]
  // TTL   → 3 minutes (if not matched, remove from queue)
  matchQueue: (topic, questionCount, opponentType, playerClass) =>
    `queue:${topic}:${questionCount}:${opponentType}:${playerClass}`,

  // Hash  → stores full queue entry data for a user
  // { userId, username, level, topic, questionCount, opponentType, class, teamId?, joinedAt }
  queueEntry: (userId) => `queue:entry:${userId}`,

  // ─────────────────────────────────────────────
  // 3. TEMPORARY GAME TEAMS (for solo players grouped into duo/trio/squad)
  // ─────────────────────────────────────────────

  // Hash  → { teamId, members: JSON[], topic, questionCount, createdAt }
  // TTL   → 10 minutes (auto-disband if game doesn't start)
  tempTeam: (tempTeamId) => `tempteam:${tempTeamId}`,

  // ─────────────────────────────────────────────
  // 4. ACTIVE GAME SESSION
  // ─────────────────────────────────────────────

  // Hash  → all game state (see gameController for full field list)
  // Fields: gameId, topic, totalQuestions, questionsAsked, status,
  //         teamAId, teamBId, currentTeam, currentTurnOrder,
  //         teamAScore, teamBScore, startedAt, mode
  // TTL   → 2 hours (max game duration)
  gameSession: (gameId) => `game:${gameId}:session`,

  // ─────────────────────────────────────────────
  // 5. TURN ORDER
  // ─────────────────────────────────────────────

  // List  → [ userId, userId, ... ] ordered turn sequence for a team
  // e.g.  game:abc123:teamA:turnOrder → [user1, user3, user2, user4]
  teamTurnOrder: (gameId, teamKey) => `game:${gameId}:${teamKey}:turnOrder`,

  // String → userId of who is currently asking the question
  currentAsker: (gameId) => `game:${gameId}:currentAsker`,

  // ─────────────────────────────────────────────
  // 6. CURRENT QUESTION
  // ─────────────────────────────────────────────

  // Hash  → { question, askedBy, askedByTeam, translatedQuestion,
  //           correctAnswer, pinnedAt, status }
  // status = 'asking' | 'pinned' | 'answering' | 'done'
  // TTL   → auto-expires after question round ends (40s max)
  currentQuestion: (gameId) => `game:${gameId}:currentQuestion`,

  // ─────────────────────────────────────────────
  // 7. HAND RAISING
  // ─────────────────────────────────────────────

  // Sorted Set  → members = userId, score = timestamp (ms)
  // The player with the LOWEST score raised hand first
  // TTL   → 10s (the pin window)
  raisedHands: (gameId) => `game:${gameId}:raisedHands`,

  // ─────────────────────────────────────────────
  // 8. SCORES (per player and per team, during game)
  // ─────────────────────────────────────────────

  // Hash  → { [userId]: score, [userId]: score, ... }
  playerScores: (gameId) => `game:${gameId}:playerScores`,

  // Hash  → { teamA: score, teamB: score }
  teamScores: (gameId) => `game:${gameId}:teamScores`,

  // ─────────────────────────────────────────────
  // 9. TIMERS (TTL-based — we set a key, its expiry IS the timer)
  // Socket.IO listens for keyspace expiry events to trigger next step
  // ─────────────────────────────────────────────

  // Exists = timer running | Expired/missing = timer done
  timerAskQuestion: (gameId) => `game:${gameId}:timer:ask`,      // 15s — player must ask
  timerPinWindow:   (gameId) => `game:${gameId}:timer:pin`,      // 10s — pin + raise hand
  timerAnswer:      (gameId) => `game:${gameId}:timer:answer`,   // 15s — answerer must reply
  timerAskerAnswer: (gameId) => `game:${gameId}:timer:askerAns`, // 15s — asker answers their own Q
  timerDiscussion:  (gameId) => `game:${gameId}:timer:discuss`,  // 10s — team agrees on answerer
  timerGreet:       (gameId) => `game:${gameId}:timer:greet`,    // 30s — pre-game greet phase
  timerGoodbye:     (gameId) => `game:${gameId}:timer:goodbye`,  // after game ends
  timerDebatePoint: (gameId) => `game:${gameId}:timer:debatePoint`, // 5 min — debate point presentation

  // ─────────────────────────────────────────────
  // 10. PLAYERS IN GAME (who is still connected)
  // ─────────────────────────────────────────────

  // Set   → { userId, userId, ... } — remove on disconnect
  activePlayers: (gameId) => `game:${gameId}:activePlayers`,

  // Hash  → { [userId]: socketId } — for direct socket targeting
  playerSockets: (gameId) => `game:${gameId}:playerSockets`,

  // ─────────────────────────────────────────────
  // 11. AI ANSWER CACHE
  // AI pre-computes correct answer during 10s pin window → stored here
  // ─────────────────────────────────────────────

  // String → correct answer string
  // TTL   → 5 minutes (enough to outlast the question round)
  aiAnswer: (gameId, questionHash) => `game:${gameId}:ai:${questionHash}`,

  // ─────────────────────────────────────────────
  // 12. CHALLENGE / GAME INVITE
  // ─────────────────────────────────────────────

  // Hash  → { fromUserId, toTeamId/toUserId, topic, questionCount, opponentType, status }
  // TTL   → 2 minutes
  challengeRequest: (challengeId) => `challenge:${challengeId}`,

  // ─────────────────────────────────────────────
  // 13. DEBATE POINTS (for AI judging)
  // ─────────────────────────────────────────────

  // List  → [ { userId, team, point, turnNumber, timestamp }, ... ]
  debatePoints: (gameId) => `game:${gameId}:debatePoints`,
  
  // ─────────────────────────────────────────────
  // 14. QUIZ QUESTION HISTORY (for game records)
  // ─────────────────────────────────────────────

  // List  → [ { question, correctAnswer, askedBy, answeredBy, ... }, ... ]
  questionHistory: (gameId) => `game:${gameId}:questionHistory`,

};

export default K;