import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  raterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ratedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  stars: { type: Number, min: 1, max: 5 },
  questionNumber: Number,
  question: String,
}, { _id: false });

const gameHistorySchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  topic: { type: String, required: true },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    team: { type: String, enum: ['teamA', 'teamB'] },
  }],
  questions: [{
    number: Number,
    text: String,
  }],
  ratings: [ratingSchema],
  totalQuestions: Number,
  playedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Index so we can quickly fetch a user's games
gameHistorySchema.index({ 'players.userId': 1, playedAt: -1 });

export default mongoose.model('GameHistory', gameHistorySchema);