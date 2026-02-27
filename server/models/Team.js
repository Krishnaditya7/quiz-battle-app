
import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,   // ← fixed
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['leader', 'member'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'muted', 'kicked'],
      default: 'active',
    },
  }],
  maxMembers: {
    type: Number,
    default: 4,
  },
  topics: [{
    type: String,
    required: true,
  }],
  dp: {
    type: String,
    default: '',
    trim: true,
  },
  minPlayerLevelRequired: {
    type: Number,
    default: 1,
  },
  totalWon: {
    type: Number,
    default: 0,
  },
  totalLoss: {
    type: Number,
    default: 0,
  },
  draws: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// ── Virtual: is team full? ──
teamSchema.virtual('isFull').get(function () {
  return this.members.length >= this.maxMembers;
});

// ── Virtual: get leader ──
teamSchema.virtual('leader').get(function () {
  return this.members.find(m => m.role === 'leader');
});

const Team = mongoose.model('Team', teamSchema);
export default Team;