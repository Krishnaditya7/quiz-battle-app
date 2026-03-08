import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function TeamManagementModal({ show, onClose }) {
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  
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
    gameMode: 'quiz',
    topicCategory: 'learning',
    stance: ''
  });

  const [inviteUserId, setInviteUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

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
    try {
      // Set current team first
      await axios.post(`http://localhost:5000/api/team/${selectedTeam._id}/set-current`, {}, {
        withCredentials: true
      });

      // Join queue
      const res = await axios.post('http://localhost:5000/api/match/queue/join', {
        ...queueData,
        playMode: 'team'
      }, { withCredentials: true });

      if (res.data.success) {
        alert('Team added to queue! Searching for opponents...');
        setShowQueueModal(false);
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to join queue');
    }
  };

  const handleInvite = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/team/${selectedTeam._id}/invite`,
        { userIdToInvite: inviteUserId },
        { withCredentials: true }
      );
      if (res.data.success) {
        alert('User invited successfully!');
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
    const user = JSON.parse(localStorage.getItem('user'));
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
            <div className="bg-slate-900 rounded-3xl p-8 max-w-2xl w-full border-2 border-blue-500/30 h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-blue-300">{selectedTeam.name} Chat</h3>
                <button onClick={() => setShowChatModal(false)} className="text-2xl">✕</button>
              </div>

              <div className="flex-1 bg-slate-800/50 rounded-2xl p-4 mb-4 overflow-y-auto">
                <p className="text-slate-400 text-center">Chat system coming soon...</p>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">
                  Send
                </button>
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

                {/* Game Mode */}
                <div className="grid grid-cols-3 gap-2">
                  {['quiz', 'debate', 'discussion'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setQueueData({...queueData, gameMode: mode})}
                      className={`py-2 rounded-xl capitalize ${
                        queueData.gameMode === mode ? 'bg-purple-600' : 'bg-slate-800'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

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

                {/* Question Count */}
                {queueData.gameMode !== 'discussion' && (
                  <select
                    value={queueData.questionCount}
                    onChange={(e) => setQueueData({...queueData, questionCount: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-800 rounded-xl text-white"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} Questions</option>)}
                  </select>
                )}

                {/* Stance (Debate) */}
                {queueData.gameMode === 'debate' && (
                  <div className="grid grid-cols-2 gap-2">
                    {['for', 'against'].map(s => (
                      <button
                        key={s}
                        onClick={() => setQueueData({...queueData, stance: s})}
                        className={`py-2 rounded-xl capitalize ${
                          queueData.stance === s ? 'bg-purple-600' : 'bg-slate-800'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

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