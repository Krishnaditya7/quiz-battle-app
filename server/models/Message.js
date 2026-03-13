import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'voice', 'document', 'pdf', 'location', 'system'],
    required: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: 4000
  },

  // Media
  fileURL: String,
  fileName: String,
  mimeType: String,
  fileSize: Number,
  duration: Number,
  thumbnailURL: String,

  // Read receipts
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  }],

  // Soft delete — "delete for me" per user
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Edit support
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },

  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

}, { timestamps: true }); // ← use timestamps instead of manual createdAt

// Indexes for fast querying
messageSchema.index({ team: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;