// ============================================================
// GAME MODEL — Fixed version
// Bug fixed: Schema → mongoose.Schema throughout
// This model is written to ONLY after a game finishes (permanent record)
// All live game state lives in Redis during gameplay
// ============================================================

import mongoose from 'mongoose';

const completedGameSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['solo', 'team'],
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  totalQuestions: {
    type: Number,
    enum: [5, 10, 15, 20],  // 0 for discussion mode
    required: true,
  },
  opponentType: {
    type: String,
    enum: ['solo', 'duo', 'trio', 'squad', 'default'],
  },
  participants: [{
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    finalScore: { type: Number, default: 0 },
    hasLeft:    { type: Boolean, default: false },
  }],
  
  // For QUIZ mode only - stores Q&A history
  questions: [{
    question:          { type: String },
  }],
  

  finalScore: { type: Number, default: 0 },
}, { timestamps: true });

const Game = mongoose.model('Game', completedGameSchema);
export default Game;