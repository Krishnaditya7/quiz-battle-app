import mongoose from 'mongoose';

const questionAnswerSchema = new mongoose.Schema({
  questionNumber: {
    type: Number,
    required: true
  },
  askedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  askedByTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null  // null if solo player
  },
  question: {
    type: String,
    required: true
  },
  correctAnswer: {
    type: String,
    required: true
  },
  timeToAsk: {
    type: Number,  // Time taken to ask (in seconds)
    default: 0
  },
  askedAt: {
    type: Date,
    default: Date.now
  },
  raisedHands: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    raisedAt: {
      type: Date,
      default: Date.now
    }
  }],
  answeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  answeredByTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  givenAnswer: {
    type: String,
    default: ''
  },
  timeToAnswer: {
    type: Number,  // Time taken to answer (in seconds)
    default: 0
  },
  answeredAt: {
    type: Date,
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  pointsAwarded: {
    type: Number,
    default: 0
  },
  askerAnsweredCorrectly: {
    type: Boolean,
    default: null
  },
  discussionUsed: {
    type: Boolean,
    default: false  // Was 15-second discussion used?
  }
});

const playerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null  // null for solo players
  },
  levelSnapshot: {
     type: Number,
  required: true,
  min: 1
  },
  isSolo: {
    type: Boolean,
    default: true
  },
  score: {
    type: Number,
    default: 0
  },
  questionsAsked: {
    type: Number,
    default: 0
  },
  questionsRemaining: {
    type: Number,
    required: true  // Decreases when time expires or question asked
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  timeoutCount: {
    type: Number,
    default: 0  // Number of times player exceeded ask time
  },
  turnOrder: {
    type: Number,  // Position in turn sequence (0, 1, 2, 3 for squad)
    default: 0
  }
});

const teamParticipantSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  players: [playerSchema],
  totalScore: {
    type: Number,
    default: 0
  },
  turnSequence: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],  // Random sequence of players for asking questions
  currentTurn: {
    type: Number,
    default: 0  // Index in turnSequence
  }
});

const gameSchema = new mongoose.Schema({
  gameType: {
    type: String,
    enum: ['solo', 'duo', 'trio','squad'],
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  numberOfQuestions: {
    type: Number,
    required: true,
    min: 5,
    max: 20
  },
  
  // Participants (can be mix of solo and teams)
  participants: {
    soloPlayers: [playerSchema],
    teams: [teamParticipantSchema]
  },
  
  questionsAndAnswers: [questionAnswerSchema],
  
  // Turn management
  currentTurn: {
    participantType: {
      type: String,
      enum: ['solo', 'team'],
      default: null
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'currentTurn.participantType'  // References User if solo, Team if team
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'  // Specific player whose turn it is
    },
    turnStartedAt: {
      type: Date,
      default: null
    },
    timeRemaining: {
      type: Number,
      default: 60  // 60 seconds to ask
    },
    phase: {
      type: String,
      enum: ['asking', 'hand-raising', 'discussing', 'answering', 'evaluation'],
      default: 'asking'
    }
  },
  
  // Hand raising state
  handRaisingState: {
    isActive: {
      type: Boolean,
      default: false
    },
    startedAt: {
      type: Date,
      default: null
    },
    raisedHands: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    }]
  },
  
  // Discussion state
  discussionState: {
    isActive: {
      type: Boolean,
      default: false
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    startedAt: {
      type: Date,
      default: null
    },
    timeRemaining: {
      type: Number,
      default: 15  // 15 seconds discussion
    }
  },
  
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'completed', 'cancelled'],
    default: 'waiting'
  },
  
  // Results
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'winnerType'
  },
  winnerType: {
    type: String,
    enum: ['User', 'Team', null],
    default: null
  },
  winnerTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  result: {
    type: String,
    enum: ['win', 'loss', 'draw', 'pending'],
    default: 'pending'
  },
  
  ratingChanges: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    oldRating: Number,
    newRating: Number,
    change: Number
  }],
  
  // Voice/Chat state
  voiceChannelId: {
    type: String,
    default: null
  },
  chatEnabled: {
    type: Boolean,
    default: true
  },
  
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Helper method to get next turn
gameSchema.methods.getNextTurn = function() {
  // Complex logic to determine next player in sequence
  // Will implement in game controller
};

// Helper method to check if game should end
gameSchema.methods.shouldGameEnd = function() {
  // Check if all players have asked their allocated questions
  let allQuestionsAsked = true;
  
  // Check solo players
  this.participants.soloPlayers.forEach(player => {
    if (player.questionsRemaining > 0) {
      allQuestionsAsked = false;
    }
  });
  
  // Check team players
  this.participants.teams.forEach(team => {
    team.players.forEach(player => {
      if (player.questionsRemaining > 0) {
        allQuestionsAsked = false;
      }
    });
  });
  
  return allQuestionsAsked;
};

const Game = mongoose.model('Game', gameSchema);

export default Game;