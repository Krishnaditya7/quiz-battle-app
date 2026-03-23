
const K = {


  userOnline: (userId) => `user:${userId}:online`,

  matchQueue: (topic, questionCount, opponentType, playerClass) =>
    `queue:${topic}:${questionCount}:${opponentType}:${playerClass}`,

  queueEntry: (userId) => `queue:entry:${userId}`,

  tempTeam: (tempTeamId) => `tempteam:${tempTeamId}`,


  gameSession: (gameId) => `game:${gameId}:session`,

  /* Future Plans
  timerAskQuestion: (gameId) => `game:${gameId}:timer:ask`,      // 15s — player must ask
  timerPinWindow:   (gameId) => `game:${gameId}:timer:pin`,      // 10s — pin + raise hand
  timerAnswer:      (gameId) => `game:${gameId}:timer:answer`,   // 15s — answerer must reply
  timerAskerAnswer: (gameId) => `game:${gameId}:timer:askerAns`, // 15s — asker answers their own Q
  timerDiscussion:  (gameId) => `game:${gameId}:timer:discuss`,  // 10s — team agrees on answerer
  timerGreet:       (gameId) => `game:${gameId}:timer:greet`,    // 30s — pre-game greet phase
  timerGoodbye:     (gameId) => `game:${gameId}:timer:goodbye`,  // after game ends
  timerDebatePoint: (gameId) => `game:${gameId}:timer:debatePoint`, // 5 min — debate point presentation
*/

   timerGreet:       (gameId) => `game:${gameId}:timer:greet`,    // 30s — pre-game greet phase
  activePlayers: (gameId) => `game:${gameId}:activePlayers`,

  playerSockets: (gameId) => `game:${gameId}:playerSockets`,



  challengeRequest: (challengeId) => `challenge:${challengeId}`,


  // ai report creation on the topic questions
  questionHistory: (gameId) => `game:${gameId}:questionHistory`,
  leaderboards : (type) => `leaderboard:${type}`,

};

export default K;