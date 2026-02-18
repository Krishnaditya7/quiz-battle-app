import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
      'friend_request',
      'friend_accepted',
      'Challenge_request',
      'Challenge_accepted',
      'team_invite',
      'team_join_request',
      'team_invite_accepted',
      'team_invite_rejected',
      'game_invite',
      'other'
        ],
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  },
  message: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;