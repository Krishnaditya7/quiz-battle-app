import mongoose from 'mongoose';
const completedGameSchema = new Schema({
  mode: { type: String, enum: ['solo', 'team'], required: true },
  participants: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    team: { type: Schema.Types.ObjectId, ref: 'Team' }, // null if solo
    finalScore: Number,
    isMVP: Boolean,
    hasLeft: Boolean
  }],
  questions: [{
    askedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    askedByTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    question: { type: String, required: true },
    correctAnswer: { type: String },
    answeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    answeredByTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    givenAnswer: String,
    isCorrect: Boolean,
  }],
  winnerType: { type: String, enum: ['solo', 'team'] },
  winner: { type: Schema.Types.ObjectId, ref: 'User' },       // if solo win
  winnerTeam: { type: Schema.Types.ObjectId, ref: 'Team' },   // if team win
  result: { type: String, enum: ['win', 'loss', 'draw'], default: 'draw' },
  finalScore: Number,  // team or solo total
  mvp: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Game = mongoose.model('Game', completedGameSchema);

export default Game;