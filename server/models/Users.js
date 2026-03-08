
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  bio:{
    type: String,
    maxlength: 500,
    default : ''
  },
  profilePic: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,   // ← never returned in queries unless explicitly asked
  },
  class: {
    type: String,
    required: true,
    enum: ['6', '7', '8', '9', '10', '11', '12', 'College', 'Other'],
  },
  dob: {
    type: Date,
    required: true,
  },
  topics: [{
    type: String,
    required: true,
    enum: ['JavaScript',
'Python',
'Java',
'C++',
'Data Structures',
'Algorithms',
  
// School Subjects
'Mathematics',
'Physics',
'Chemistry',
'Biology',
'History',
'Geography',
'English',
'Hindi',
  
// Other
'General Knowledge',
'Current Affairs',
'Science',
'Technology',
'Sports',
'Movies',
'Music'],
  }],
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
  },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    draws:       { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  currentTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,       // ← was NULL (wrong)
  },
  position: {
    type: String,
    default: 'Member',
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
//removed the online status in Mongo as it was already in redis
}, { timestamps: true });   // ← moved here as 2nd arg (was inside schema object before)

// ── XP → Level progression ──
// Called after each game to check if player levelled up
userSchema.methods.checkLevelUp = function () {
  // Every 100 XP = 1 level. Adjust formula as you like.
  const newLevel = Math.floor(this.xp / 100) + 1;
  if (newLevel > this.level) {
    this.level = newLevel;
    return true; // levelled up
  }
  return false;
};

const User = mongoose.model('User', userSchema);
export default User;