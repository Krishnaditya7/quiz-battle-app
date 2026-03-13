import Message from '../models/Message.js';
import Team from '../models/Team.js';

// ─────────────────────────────────────────────
// GET /api/chat/:teamId/messages
// Fetch chat history with pagination
// ─────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isMember = team.members.some(m => m.user.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a team member' });
    }

    const query = { 
      team: teamId,
      deletedFor: { $ne: userId } // ← hide messages deleted for this user
    };

    if (before) {
      const beforeMsg = await Message.findById(before);
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username level profilePic')
      .populate('replyTo', 'content sender type'); // ← populate reply preview

    return res.status(200).json({ 
      success: true, 
      messages: messages.reverse(),
      hasMore: messages.length === parseInt(limit) // ← tells frontend if more pages exist
    });

  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/chat/message/:messageId
// Edit a message
// ─────────────────────────────────────────────
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Can only edit your own messages' });
    }

    if (message.type !== 'text') {
      return res.status(400).json({ success: false, message: 'Can only edit text messages' });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    return res.status(200).json({ success: true, message });

  } catch (err) {
    console.error('Edit message error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/chat/message/:messageId
// Soft delete for me or delete for everyone (sender only)
// ─────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor } = req.body; // 'me' or 'everyone'
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (deleteFor === 'everyone') {
      // Only sender can delete for everyone
      if (message.sender.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Only sender can delete for everyone' });
      }
      await Message.findByIdAndDelete(messageId);
      return res.status(200).json({ success: true, deletedFor: 'everyone', messageId });
    }

    // Delete for me only
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
      await message.save();
    }

    return res.status(200).json({ success: true, deletedFor: 'me', messageId });

  } catch (err) {
    console.error('Delete message error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/chat/:teamId/read
// Mark ALL unread messages in a team as read
// ─────────────────────────────────────────────
export const markAllAsRead = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    // Update all messages not yet read by this user
    await Message.updateMany(
      { 
        team: teamId, 
        'readBy.user': { $ne: userId },
        sender: { $ne: userId } // don't mark your own messages
      },
      { 
        $push: { readBy: { user: userId, at: new Date() } }
      }
    );

    return res.status(200).json({ success: true, message: 'All messages marked as read' });

  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};