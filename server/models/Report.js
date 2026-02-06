import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  },
  reason: {
    type: String,
    required: true,
    enum: ['abuse', 'cheating', 'inappropriate_language', 'spam', 'other']
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Report = mongoose.model('Report', reportSchema);

export default Report;