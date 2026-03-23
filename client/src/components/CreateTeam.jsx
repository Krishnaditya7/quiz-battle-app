import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function TeamManagementModal({ show, onClose, socket, user}) {
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState({}); // { userId: username }
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const [createTeamData, setCreateTeamData] = useState({
    name: '',
    maxMembers: 4,
    topics: []
  });

  const [queueData, setQueueData] = useState({
    topic: '',
    questionCount: 10,
    playerCount: 4,
    opponentType: 'squad',
    topicCategory: 'learning',
  });
  const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

useEffect(() => {
  scrollToBottom();
}, [messages]);

// Join chat room and load history when modal opens
useEffect(() => {
  if (!showChatModal || !selectedTeam || !socket) return;

  // Join socket room
  socket.emit('chat:join', { 
    teamId: selectedTeam._id, 
    userId: user._id 
  });

  // Load message history via REST
  fetchMessages();

  // Listen for new messages
  socket.on('chat:newMessage', ({ message }) => {
    setMessages(prev => [...prev, message]);
  });

  // Typing indicators
  socket.on('chat:userTyping', ({ userId, username }) => {
    setIsTyping(prev => ({ ...prev, [userId]: username }));
  });

  socket.on('chat:userStoppedTyping', ({ userId }) => {
    setIsTyping(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  });

  // Message deleted
  socket.on('chat:messageDeleted', ({ messageId, deletedFor }) => {
    if (deletedFor === 'everyone') {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    } else {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    }
  });

  // Message edited
  socket.on('chat:messageEdited', ({ message }) => {
    setMessages(prev => prev.map(m => m._id === message._id ? message : m));
  });

  // Mark all as read
  axios.patch(
    `http://localhost:5000/api/chat/${selectedTeam._id}/read`,
    {},
    { withCredentials: true }
  ).catch(err => console.log('Mark read error:', err));

  return () => {
    socket.emit('chat:leave', { teamId: selectedTeam._id });
    socket.off('chat:newMessage');
    socket.off('chat:userTyping');
    socket.off('chat:userStoppedTyping');
    socket.off('chat:messageDeleted');
    socket.off('chat:messageEdited');
  };
}, [showChatModal, selectedTeam, socket]);

const fetchMessages = async (before = null) => {
  try {
    setLoadingMessages(true);
    const url = before
      ? `http://localhost:5000/api/chat/${selectedTeam._id}/messages?limit=50&before=${before}`
      : `http://localhost:5000/api/chat/${selectedTeam._id}/messages?limit=50`;

    const res = await axios.get(url, { withCredentials: true });
    if (res.data.success) {
      if (before) {
        setMessages(prev => [...res.data.messages, ...prev]); // prepend older messages
      } else {
        setMessages(res.data.messages);
      }
      setHasMore(res.data.hasMore);
    }
  } catch (err) {
    console.error('Fetch messages error:', err);
  } finally {
    setLoadingMessages(false);
  }
};

const handleSendMessage = () => {
  if (!newMessage.trim() || !socket) return;

  socket.emit('chat:sendMessage', {
    teamId: selectedTeam._id,
    type: 'text',
    content: newMessage.trim(),
  });

  setNewMessage('');

  // Stop typing indicator
  socket.emit('chat:stopTyping', { 
    teamId: selectedTeam._id, 
    userId: user._id 
  });
};

const handleTyping = (e) => {
  setNewMessage(e.target.value);

  if (!socket) return;

  // Emit typing
  socket.emit('chat:typing', {
    teamId: selectedTeam._id,
    userId: user._id,
    username: user.username,
  });

  // Stop typing after 2 seconds of inactivity
  clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socket.emit('chat:stopTyping', {
      teamId: selectedTeam._id,
      userId: user._id,
    });
  }, 2000);
};

const handleDeleteMessage = (messageId, isMine) => {
  if (!socket) return;

  if (isMine) {
    const choice = confirm('Delete for everyone or just for you?\nOK = Everyone | Cancel = Just me');
    socket.emit('chat:deleteMessage', {
      teamId: selectedTeam._id,
      messageId,
      deleteFor: choice ? 'everyone' : 'me',
    });
  } else {
    socket.emit('chat:deleteMessage', {
      teamId: selectedTeam._id,
      messageId,
      deleteFor: 'me',
    });
  }
};

const handleKeyPress = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString();
};
  const [inviteUserId, setInviteUserId] = useState('');

  const topics = ['Math', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'];

  useEffect(() => {
    if (show) {
      fetchMyTeams();
    }
  }, [show]);

  const fetchMyTeams = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/team/my-teams', {
        withCredentials: true
      });
      setMyTeams(res.data.teams || []);
    } catch (err) {
      console.error('Fetch teams error:', err);
    }
  };

  const handleCreateTeam = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/team/create', createTeamData, {
        withCredentials: true
      });
      if (res.data.success) {
        setShowCreateModal(false);
        fetchMyTeams();
        setCreateTeamData({ name: '', maxMembers: 4, topics: [] });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create team');
    }
  };
  const handleStartQueue = async () => {
    if (!socket) {
      alert('Not connected to server!');
      return;
    }

    if (!user || !user._id) {
      alert('User not loaded!');
      return;
    }

    if (!queueData.topic) {
      alert('Please select topic');
      return;
    }

    try {
      // Step 1 — set current team via REST (still needed so backend knows which team)
      await axios.post(
        `http://localhost:5000/api/team/${selectedTeam._id}/set-current`,
        {},
        { withCredentials: true }
      );

      // Step 2 — listen for queue confirmation

      socket.once('error', ({ message }) => {
        alert(message);
      });
    sessionStorage.setItem('pendingQueueData', JSON.stringify(queueData));

      // Step 3 — emit socket event instead of REST
      socket.emit('match:joinQueue', {
        userId: user._id,
        username: user.username,
        level: user.level ?? 1,
        playerClass: user.class,
        topic: queueData.topic,
        questionCount: queueData.questionCount,
        playerCount: queueData.playerCount,
        opponentType: queueData.opponentType,
        teamId: selectedTeam._id,
        onlineTeamMembers: [],
      });

    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start queue');
    }
  };
const handleInvite = async () => {
  try {
    // Search user first to get their _id
    const searchRes = await axios.get(
      `http://localhost:5000/api/user/search?query=${inviteUserId}`,
      { withCredentials: true }
    );
    
    if (!searchRes.data.users?.length) {
      alert('User not found');
      return;
    }

    const targetUser = searchRes.data.users[0];
    
    // Now send actual _id
    const res = await axios.post(
      `http://localhost:5000/api/team/${selectedTeam._id}/invite`,
      { userIdToInvite: targetUser._id },  // ← real _id
      { withCredentials: true }
    );

    if (res.data.success) {
      alert(`Invite sent to ${targetUser.username}!`);
      setShowInviteModal(false);
      setInviteUserId('');
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to invite user');
  }
};

  const handleKickMember = async (memberId) => {
    if (!confirm('Are you sure you want to kick this member?')) return;
    
    try {
      const res = await axios.post(
        `http://localhost:5000/api/team/${selectedTeam._id}/kick`,
        { userIdToKick: memberId },
        { withCredentials: true }
      );
      if (res.data.success) {
        alert('Member removed');
        fetchMyTeams();
        setShowMembersModal(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to kick member');
    }
  };

  const handleAddTopic = async (topic) => {
    try {
      const res = await axios.patch(
        `http://localhost:5000/api/team/${selectedTeam._id}/update`,
        { addTopic: topic },
        { withCredentials: true }
      );
      if (res.data.success) {
        fetchMyTeams();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add topic');
    }
  };

  const handleRemoveTopic = async (topic) => {
    try {
      const res = await axios.patch(
        `http://localhost:5000/api/team/${selectedTeam._id}/update`,
        { removeTopic: topic },
        { withCredentials: true }
      );
      if (res.data.success) {
        fetchMyTeams();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove topic');
    }
  };

  const isLeader = (team) => {
    return team.members?.some(m => m.user._id === user?._id && m.role === 'leader');
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-3xl p-8 max-w-5xl w-full border-2 border-blue-500/30 max-h-[90vh] overflow-y-auto animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-4xl font-black text-blue-300">MY TEAMS</h2>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-2xl transition-all"
          >
            ✕
          </button>
        </div>

        {/* Create Team Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full mb-6 py-4 border-2 border-dashed border-blue-500/50 rounded-2xl hover:border-blue-500 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-3 text-blue-400 font-bold"
        >
          <span className="text-3xl">+</span>
          CREATE NEW TEAM
        </button>

        {/* Teams List */}
        <div className="space-y-4">
          {myTeams.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-6xl mb-4">👥</div>
              <p>No teams yet. Create your first team!</p>
            </div>
          ) : (
            myTeams.map(team => (
              <div 
                key={team._id}
                className="bg-slate-800/50 border border-blue-500/20 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start gap-6">
                  {/* Team DP */}
                  <div className="relative flex-shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-4xl">
                      {team.dp ? (
                        <img src={team.dp} alt={team.name} className="w-full h-full rounded-2xl object-cover" />
                      ) : (
                        '🛡️'
                      )}
                    </div>
                    {isLeader(team) && (
                      <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-500 transition-all">
                        📷
                      </button>
                    )}
                  </div>

                  {/* Team Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-2xl font-black text-white mb-1">{team.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span>Level {team.level}</span>
                          <span>•</span>
                          <span>{team.members?.length}/{team.maxMembers} members</span>
                          {isLeader(team) && (
                            <>
                              <span>•</span>
                              <span className="text-yellow-400">👑 Leader</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Topics */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {team.topics?.map(topic => (
                        <span 
                          key={topic}
                          className="px-3 py-1 bg-blue-600/30 border border-blue-500/50 rounded-full text-sm text-blue-300 flex items-center gap-2"
                        >
                          {topic}
                          {isLeader(team) && (
                            <button 
                              onClick={() => {
                                setSelectedTeam(team);
                                handleRemoveTopic(topic);
                              }}
                              className="hover:text-white"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap">
                      {/* Chat */}
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowChatModal(true);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-2 transition-all"
                      >
                        💬 Chat
                      </button>

                      {/* Members */}
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowMembersModal(true);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-2 transition-all"
                      >
                        👥 Members
                      </button>

                      {/* Invite (Leader only) */}
                      {isLeader(team) && (
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowInviteModal(true);
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-2 transition-all"
                        >
                          ➕ Invite
                        </button>
                      )}

                      {/* Topics (Leader only) */}
                      {isLeader(team) && (
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            // Show topic selector inline
                            const newTopic = prompt('Enter topic to add:');
                            if (newTopic) handleAddTopic(newTopic);
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-2 transition-all"
                        >
                          📚 Topics
                        </button>
                      )}

                      {/* START GAME (Leader only) */}
                      {isLeader(team) && (
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setQueueData({
                              ...queueData,
                              playerCount: team.members?.filter(m => m.status === 'active').length || 1
                            });
                            setShowQueueModal(true);
                          }}
                          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/50 rounded-xl font-bold transition-all"
                        >
                          🎮 START GAME
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CREATE TEAM MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-blue-500/30">
              <h3 className="text-3xl font-black text-blue-300 mb-6">CREATE TEAM</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Team Name"
                  value={createTeamData.name}
                  onChange={(e) => setCreateTeamData({...createTeamData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />

                <select
                  value={createTeamData.maxMembers}
                  onChange={(e) => setCreateTeamData({...createTeamData, maxMembers: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value={2}>2 Members</option>
                  <option value={3}>3 Members</option>
                  <option value={4}>4 Members</option>
                </select>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Topics</label>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          if (createTeamData.topics.includes(t)) {
                            setCreateTeamData({
                              ...createTeamData,
                              topics: createTeamData.topics.filter(topic => topic !== t)
                            });
                          } else {
                            setCreateTeamData({
                              ...createTeamData,
                              topics: [...createTeamData.topics, t]
                            });
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-all ${
                          createTeamData.topics.includes(t)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTeam}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHAT MODAL (Placeholder) */}
        {showChatModal && selectedTeam && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
    <div className="bg-slate-900 rounded-3xl max-w-2xl w-full border-2 border-blue-500/30 h-[600px] flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-slate-700/50">
        <div>
          <h3 className="text-2xl font-black text-blue-300">{selectedTeam.name}</h3>
          <p className="text-sm text-slate-400">
            {selectedTeam.members?.length} members
          </p>
        </div>
        <button 
          onClick={() => setShowChatModal(false)} 
          className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-all"
        >
          ✕
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        
        {/* Load More Button */}
        {hasMore && (
          <div className="text-center mb-4">
            <button
              onClick={() => fetchMessages(messages[0]?._id)}
              disabled={loadingMessages}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-300 transition-all"
            >
              {loadingMessages ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="text-5xl mb-3">💬</div>
            <p>No messages yet. Say hello!</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
          const isMine = msg.sender._id === user._id || msg.sender === user._id;
          const prevMsg = messages[index - 1];
          const showDate = !prevMsg || 
            formatDate(msg.createdAt) !== formatDate(prevMsg.createdAt);
          const showAvatar = !prevMsg || 
            prevMsg.sender._id !== msg.sender._id;

          return (
            <div key={msg._id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 px-2">
                    {formatDate(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
              )}

              <div className={`flex gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm">
                    👤
                  </div>
                </div>

                {/* Bubble */}
                <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  
                  {/* Sender name (others only) */}
                  {!isMine && showAvatar && (
                    <span className="text-xs text-purple-400 mb-1 px-1">
                      {msg.sender.username}
                    </span>
                  )}

                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div className={`text-xs px-3 py-1 rounded-lg mb-1 border-l-2 border-purple-500 bg-slate-700/50 text-slate-400 max-w-full truncate`}>
                      {msg.replyTo.content}
                    </div>
                  )}

                  <div className={`relative px-4 py-2 rounded-2xl ${
                    isMine 
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-sm' 
                      : 'bg-slate-700/80 text-white rounded-tl-sm'
                  }`}>
                    <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                    
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs opacity-60">
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.isEdited && (
                        <span className="text-xs opacity-60">· edited</span>
                      )}
                    </div>

                    {/* Delete button on hover */}
                    <button
                      onClick={() => handleDeleteMessage(msg._id, isMine)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full text-xs hidden group-hover:flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {Object.keys(isTyping).length > 0 && (
          <div className="flex items-center gap-2 text-slate-400 text-sm px-4">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {Object.values(isTyping).join(', ')} 
              {Object.keys(isTyping).length === 1 ? ' is' : ' are'} typing...
            </span>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex gap-3 items-end">
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={handleKeyPress}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 transition-all"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            Send
          </button>
        </div>
      </div>

    </div>
  </div>
)}
        
        {/* MEMBERS MODAL */}
        {showMembersModal && selectedTeam && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-blue-500/30">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-blue-300">Team Members</h3>
                <button onClick={() => setShowMembersModal(false)} className="text-2xl">✕</button>
              </div>

              <div className="space-y-3">
                {selectedTeam.members?.map(member => (
                  <div key={member.user._id} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                    <div>
                      <div className="font-bold">{member.user.username}</div>
                      <div className="text-sm text-slate-400">Level {member.user.level}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {member.role === 'leader' && (
                        <span className="text-yellow-400">👑</span>
                      )}
                      {isLeader(selectedTeam) && member.role !== 'leader' && (
                        <button
                          onClick={() => handleKickMember(member.user._id)}
                          className="w-8 h-8 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center"
                        >
                          ➖
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INVITE MODAL */}
        {showInviteModal && selectedTeam && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-blue-500/30">
              <h3 className="text-2xl font-black text-blue-300 mb-6">Invite Player</h3>
              
              <input
                type="text"
                placeholder="Enter User ID"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                >
                  Invite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUEUE MODAL (START GAME) */}
        {showQueueModal && selectedTeam && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-purple-500/30">
              <h3 className="text-3xl font-black text-purple-300 mb-6">START GAME</h3>
              
              <div className="space-y-4">
                {/* Topic */}
                <select
                  value={queueData.topic}
                  onChange={(e) => setQueueData({...queueData, topic: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 rounded-xl text-white"
                >
                  <option value="">Select Topic</option>
                  {selectedTeam.topics?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>


                {/* Player Count */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Team Size (currently {selectedTeam.members?.length} online)
                  </label>
                  <select
                    value={queueData.playerCount}
                    onChange={(e) => setQueueData({...queueData, playerCount: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-800 rounded-xl text-white"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'player' : 'players'}
                        {n > selectedTeam.members?.length && ' (will find +1 solo)'}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Opponent Type */}
                <div>
                <label className="text-sm text-slate-400 mb-2 block">
                         Choose your Opponent 
                   </label>
                   <div className="flex flex-wrap gap-2">
               {['solo', 'duo', 'trio', 'squad', 'default'].map(mode => (
               <button
                 key={mode}
                    onClick={() => setQueueData({...queueData, opponentType: mode})}
                  className={`px-4 py-2 rounded-xl capitalize ${
                   queueData.opponentType === mode ? 'bg-purple-600' : 'bg-slate-800'
                  }`}
                    >
                         {mode}
                       </button>
                          ))}

                   </div>
               </div>


                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowQueueModal(false)}
                    className="flex-1 py-3 bg-slate-700 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartQueue}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold"
                  >
                    Move to Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}