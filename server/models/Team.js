import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  type: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxMembers: {
    type: Number,
    default: 4  // For squad mode (max 4 players)
  },
  isActive: {
    type: Boolean,
    default: true
  },
  chat: [messageSchema]
}, {
  timestamps: true
});

// Virtual field to check if team is full
teamSchema.virtual('isFull').get(function() {
  return this.members.length >= this.maxMembers;
});

const Team = mongoose.model('Team', teamSchema);

export default Team;