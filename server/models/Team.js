import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  level: {
    type: Number,
default: 0,
min:1
  },
  // removed rating
  members: [{
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  role: {
    type: String,
    enum: ['leader', 'member'], // or just 'leader' vs 'member'
    default: 'member'
  },
  status: { type: String, enum: ['active', 'muted', 'kicked'], default: 'active' }
}],
  maxMembers: {
    type: Number,
    default: 4  // For squad mode (max 4 players)
  },
  topic:{
    type: String,
    required: true
  },
  // removed active...coz team players that are users should be active not the whole team
  //removed messageSchema so that people can just not only send text, but pdf,voice,etc etc
  dp:{
    type: String,
    default: "any_url",
    trim: true
  },
  minPlayerLevelRequired:{
    type: Number,
    default:0
  },
  totalWon:{
    type: Number,
    default: 0
  },
  totalLoss:{
    type: Number,
    default: 0
  },
  draws:{
    type: Number,
    default:0
  },
}, {
  timestamps: true
});

// Virtual field to check if team is full
teamSchema.virtual('isFull').get(function() {
  return this.members.length >= this.maxMembers;
});

const Team = mongoose.model('Team', teamSchema);

export default Team;