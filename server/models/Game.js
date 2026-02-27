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
  gameMode: {
    type: String,
    enum: ['quiz', 'debate', 'discussion'],
    default: 'quiz',
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
    isMVP:      { type: Boolean, default: false },
    hasLeft:    { type: Boolean, default: false },
  }],
  
  // For QUIZ mode only - stores Q&A history
  questions: [{
    askedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    askedByTeam:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    question:          { type: String },
    translatedQuestion:{ type: String },
    correctAnswer:     { type: String },
    answeredBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answeredByTeam:    { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    givenAnswer:       { type: String },
    isCorrect:         { type: Boolean },
    timestamp:         { type: Date, default: Date.now },
  }],
  
  // For DEBATE mode only - stores arguments presented
  debateArguments: [{
    presentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    team:        { type: String, enum: ['teamA', 'teamB'] },
    stance:      { type: String, enum: ['for', 'against'] },
    argument:    { type: String },
    turnNumber:  { type: Number },
    timestamp:   { type: Date, default: Date.now },
  }],
  
  winnerType: {
    type: String,
    enum: ['solo', 'team', 'draw'],
  },
  winner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  winnerTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  result: {
    type: String,
    enum: ['win', 'loss', 'draw'],
    default: 'draw',
  },
  finalScore: { type: Number, default: 0 },
  mvp:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

const Game = mongoose.model('Game', completedGameSchema);
export default Game;