const K = {
/* redis.set("user:abc123:username", "krishna");
 for redis.set(`user:${userId}:username`, username);
 KEY                          VALUE
"user:abc123:username"   ->   "krishna"

Single simple value	SET
Multiple related fields	HSET
Leaderboard	ZADD
Active game list	SET or SADD
*/

userOnline : (userId) => `user:${userId}:online`,

matchQueue: (topic, questionCount, opponentType, playerClass) =>
    `queue:${topic}:${questionCount}:${opponentType}:${playerClass}`,

    queueEntry: (userId) => `queue:entry${userId}:`,
    tempTeam: (tempTeamId) => `tempteam: ${tempTeamId}`,
    gameSession: (gameId) => `game:${gameId}:session`,
    teamTurnOrder: (gameId, teamKey) => `game:${gameId}:${teamKey}:turnOrder`,
    currentAsker: (gameId) => `game:${gameId}:currentAsker`,
    currentQuestion: (gameID) => `game:${gameID}:currentQuestion`,
    raisedHands: (gameId) => `game:${gameId}:raisedHands`,
    playerScores: (gameId) => `game:${gameId}:playerScores`,
    teamScores: (gameId) => `game:${gameId}:teamScores`,

  timerAskQuestion: (gameId) => `game:${gameId}:timer:ask`,      // 15s — player must ask
  timerPinWindow:   (gameId) => `game:${gameId}:timer:pin`,      // 10s — pin + raise hand
  timerAnswer:      (gameId) => `game:${gameId}:timer:answer`,   // 15s — answerer must reply
  timerAskerAnswer: (gameId) => `game:${gameId}:timer:askerAns`, // 15s — asker answers their own Q
  timerDiscussion:  (gameId) => `game:${gameId}:timer:discuss`,  // 10s — team agrees on answerer that he will give ans
  timerGreet:       (gameId) => `game:${gameId}:timer:greet`,    // 30s — pre-game greet phase
  timerGoodbye:     (gameId) => `game:${gameId}:timer:goodbye`,  // after game ends

  activePlayers: (gameId) => `game:${gameId}:activePlayers`,
  playerSockets: (gameId) => `game:${gameId}:playerSockets`,
  aiAnswer: (gameId, questionHash) => `game:${gameId}:ai:${questionHash}`,

  challengeRequest: (challengeId) => `challenge:${challengeId}`,
};

export default K;