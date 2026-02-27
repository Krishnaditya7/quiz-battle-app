import Message from '../models/Message.js';
import Team from '../models/Team.js';
import User from '../models/Users.js';

export const sendMessage = async (req, res) => {
  try {
    const {
      teamId,
      type,
      content,
      fileURL,
      fileName,
      mimeType,
      fileSize,
      duration,
      thumbnailURL,
    } = req.body;
    const senderId = req.userId;

    // ── Validate ──
    if (!teamId || !type) {
      return res.status(400).json({ success: false, message: 'teamId and type are required' });
    }

    const validTypes = ['text', 'image', 'video', 'voice', 'document', 'pdf', 'location', 'system'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid message type' });
    }

    // ── Check if user is in team ──
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isMember = team.members.some(m => m.user.toString() === senderId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not in this team' });
    }

    // ── Create message ──
    const message = await Message.create({
      sender: senderId,
      team: teamId,
      type,
      content: content || '',
      fileURL: fileURL || '',
      fileName: fileName || '',
      mimeType: mimeType || '',
      fileSize: fileSize || 0,
      duration: duration || 0,
      thumbnailURL: thumbnailURL || '',
    });

    // Populate sender info
    await message.populate('sender', 'username level');

    return res.status(201).json({ success: true, message });

  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.userId;

    // ── Check if user is in team ──
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isMember = team.members.some(m => m.user.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not in this team' });
    }

    // ── Build query ──
    const query = { team: teamId };
    if (before) {
      // Load messages older than the 'before' messageId (pagination)
      const beforeMsg = await Message.findById(before);
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username level');

    return res.status(200).json({ success: true, messages: messages.reverse() });

  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // ── Check if already read ──
    const alreadyRead = message.readBy.some(r => r.user.toString() === userId);
    if (alreadyRead) {
      return res.status(200).json({ success: true, message: 'Already marked as read' });
    }

    // ── Mark as read ──
    message.readBy.push({ user: userId, at: new Date() });
    await message.save();

    return res.status(200).json({ success: true, message: 'Marked as read' });

  } catch (err) {
    console.error('Mark as read error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};