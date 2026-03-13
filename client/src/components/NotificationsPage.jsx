import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function NotificationPage({ socket, user }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    if (!socket) return;

    // Real-time new notification
    socket.on('notification:new', ({ notification }) => {
      setNotifications(prev => [notification, ...prev]);
    });

    return () => {
      socket.off('notification:new');
    };
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(
        'http://localhost:5000/api/notification',
        { withCredentials: true }
      );
      if (res.data.success) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (notification) => {
    try {
      await axios.post(
        `http://localhost:5000/api/team/${notification.team._id}/accept-invite`,
        {},
        { withCredentials: true }
      );
      fetchNotifications();
      alert(`Joined ${notification.team.name}!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept invite');
    }
  };

  const handleRejectInvite = async (notification) => {
    try {
      await axios.post(
        `http://localhost:5000/api/team/${notification.team._id}/reject-invite`,
        {},
        { withCredentials: true }
      );
      fetchNotifications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject invite');
    }
  };

  const handleApproveJoinRequest = async (notification) => {
    try {
      await axios.post(
        `http://localhost:5000/api/team/${notification.team._id}/approve-join`,
        { userIdToApprove: notification.sender._id },
        { withCredentials: true }
      );
      fetchNotifications();
      alert('Join request approved!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.patch(
        'http://localhost:5000/api/notification/mark-all-read',
        {},
        { withCredentials: true }
      );
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await axios.delete(
        `http://localhost:5000/api/notification/${notificationId}`,
        { withCredentials: true }
      );
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getIcon = (type) => {
    const icons = {
      team_invite: '📨',
      team_join_request: '🙋',
      team_invite_accepted: '✅',
      team_invite_rejected: '❌',
      friend_request: '👋',
      friend_accepted: '🤝',
      game_invite: '🎮',
      other: '🔔'
    };
    return icons[type] || '🔔';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              NOTIFICATIONS
            </h1>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-red-600 rounded-full text-sm font-bold">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition-all"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xl animate-pulse">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">🔔</div>
            <p className="text-slate-400 text-xl">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notification => (
              <div
                key={notification._id}
                className={`relative bg-slate-900/50 border rounded-2xl p-6 transition-all ${
                  !notification.isRead
                    ? 'border-purple-500/50 bg-purple-500/5'
                    : 'border-slate-700/50'
                }`}
              >
                {/* Unread dot */}
                {!notification.isRead && (
                  <div className="absolute top-4 right-12 w-2 h-2 bg-red-500 rounded-full" />
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(notification._id)}
                  className="absolute top-4 right-4 w-6 h-6 text-slate-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-4xl flex-shrink-0">
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-1">
                      {notification.message}
                    </p>

                    {/* Team info */}
                    {notification.team && (
                      <p className="text-purple-400 text-sm mb-3">
                        Team: {notification.team.name}
                      </p>
                    )}

                    <p className="text-slate-500 text-xs mb-4">
                      {formatTime(notification.createdAt)}
                    </p>

                    {/* Action buttons */}
                    {notification.status === 'pending' && (
                      <div className="flex gap-3">

                        {/* Team invite — shown to invited user */}
                        {notification.type === 'team_invite' && (
                          <>
                            <button
                              onClick={() => handleAcceptInvite(notification)}
                              className="px-5 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-sm transition-all"
                            >
                              ✅ Accept
                            </button>
                            <button
                              onClick={() => handleRejectInvite(notification)}
                              className="px-5 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm transition-all"
                            >
                              ❌ Decline
                            </button>
                          </>
                        )}

                        {/* Join request — shown to team leader */}
                        {notification.type === 'team_join_request' && (
                          <>
                            <button
                              onClick={() => handleApproveJoinRequest(notification)}
                              className="px-5 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-sm transition-all"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleDelete(notification._id)}
                              className="px-5 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm transition-all"
                            >
                              ❌ Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Status badge for resolved notifications */}
                    {notification.status !== 'pending' && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        notification.status === 'accepted' 
                          ? 'bg-green-600/20 text-green-400' 
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {notification.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}