
import User from '../models/Users.js';
import Notification from '../models/Notification.js';

export const sendFriendRequest = async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.userId;

    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, message: 'Cannot send friend request to yourself' });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const fromUser = await User.findById(fromUserId);

    // Check if already friends
    if (fromUser.friends.includes(toUserId)) {
      return res.status(400).json({ success: false, message: 'Already friends' });
    }

    // Check if request already exists
    const existingNotification = await Notification.findOne({
      sender: fromUserId,
      recipient: toUserId,
      type: 'friend_request',
      status: 'pending',
    });

    if (existingNotification) {
      return res.status(400).json({ success: false, message: 'Friend request already sent' });
    }

    // Create notification
    await Notification.create({
      sender: fromUserId,
      recipient: toUserId,
      type: 'friend_request',
      message: `${fromUser.username} sent you a friend request`,
      status: 'pending',
    });

    return res.status(200).json({ success: true, message: 'Friend request sent' });

  } catch (err) {
    console.error('Send friend request error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { notificationId } = req.body;
    const userId = req.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification || notification.type !== 'friend_request') {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your notification' });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Friend request already processed' });
    }

    const senderId = notification.sender;

    // Add to both users' friends arrays
    await Promise.all([
      User.findByIdAndUpdate(userId, { $addToSet: { friends: senderId } }),
      User.findByIdAndUpdate(senderId, { $addToSet: { friends: userId } }),
    ]);

    // Update notification status
    notification.status = 'accepted';
    await notification.save();

    // Create notification for sender
    const recipient = await User.findById(userId);
    await Notification.create({
      sender: userId,
      recipient: senderId,
      type: 'friend_accepted',
      message: `${recipient.username} accepted your friend request`,
    });

    return res.status(200).json({ success: true, message: 'Friend request accepted' });

  } catch (err) {
    console.error('Accept friend request error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { notificationId } = req.body;
    const userId = req.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification || notification.type !== 'friend_request') {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your notification' });
    }

    notification.status = 'rejected';
    await notification.save();

    return res.status(200).json({ success: true, message: 'Friend request rejected' });

  } catch (err) {
    console.error('Reject friend request error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user.friends.includes(friendId)) {
      return res.status(400).json({ success: false, message: 'Not friends' });
    }

    // Remove from both users' friends arrays
    await Promise.all([
      User.findByIdAndUpdate(userId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: userId } }),
    ]);

    return res.status(200).json({ success: true, message: 'Friend removed' });

  } catch (err) {
    console.error('Remove friend error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getFriends = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).populate('friends', 'username level xp stats');

    return res.status(200).json({ success: true, friends: user.friends });

  } catch (err) {
    console.error('Get friends error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};