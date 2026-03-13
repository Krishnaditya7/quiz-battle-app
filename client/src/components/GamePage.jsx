import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import TeamManagementModal from './CreateTeam';
import JoinTeamsModal from './JoinTeam';

export default function GamePage({socket, user}) {
  const navigate = useNavigate();
  
  const [showSoloModal, setShowSoloModal] = useState(false);
  const [showTeamsList, setShowTeamsList] = useState(false);  // ← For TeamManagementModal
  const [showJoinTeams, setShowJoinTeams] = useState(false);  // ← For JoinTeamsModal
  const [isQueuing, setIsQueuing] = useState(false);

  const [soloQueueData, setSoloQueueData] = useState({
    topic: '',
    questionCount: 10,
    playerCount: 1,
    gameMode: 'quiz',
    stance: '',
    opponentType: 'default'
  });

  const topics = [
    'Math', 'Science', 'Physics', 'Chemistry', 'Biology',
    'History', 'Geography', 'English', 'Computer Science'
  ];
useEffect(() => {
    if (!socket) return;

    socket.on('match:queued', ({ message }) => {
      console.log('Queued:', message);
      navigate('/waiting-room', {
        state: { queueData: soloQueueData,
         myTeam: {
        name: user.currentTeam ? 'My Team' : user.username,
        members: [{
          username: user.username,
          level: user.level,
          avatar: user.profilePic || '👤'
        }]
      }
     }
      });
    });

    socket.on('error', ({ message }) => {
      alert(message);
      setIsQueuing(false);
    });

    return () => {
      socket.off('match:queued');
      socket.off('error');
    };
  }, [socket, soloQueueData]);
  
  const handleSoloQueue = () => {
    if (!socket) {
      alert('Not connected to server!');
      return;
    }

    if (!soloQueueData.topic || !soloQueueData.gameMode) {
      alert('Please select topic and game mode');
      return;
    }

    if (soloQueueData.gameMode === 'debate' && !soloQueueData.stance) {
      alert('Please select stance for debate');
      return;
    }

    setIsQueuing(true);

    // Single socket emit — no REST API needed
    sessionStorage.setItem('pendingQueueData', JSON.stringify(soloQueueData));
    sessionStorage.setItem('pendingMyTeam', JSON.stringify({
    name: user.username,
    members: [{ username: user.username, level: user.level, avatar: user.profilePic || '👤' }]
}));

    socket.emit('match:joinQueue', {
      userId: user._id,
      username: user.username,
      level: user.level ?? 1,
      playerClass: user.class,
      topic: soloQueueData.topic,
      questionCount: soloQueueData.questionCount,
      playerCount: soloQueueData.playerCount,
      gameMode: soloQueueData.gameMode,
      stance: soloQueueData.stance || null,
      opponentType: soloQueueData.opponentType,
      teamId: null,
      onlineTeamMembers: [],
    });
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            GAME MODE
          </h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all"
          >
            ← Back
          </button>
        </div>

        {/* Main 3 Buttons */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Play Solo */}
          <button
            onClick={() => setShowSoloModal(true)}
            className="group relative bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-purple-500/30 rounded-3xl p-12 hover:scale-105 transition-all duration-500 hover:border-purple-500"
          >
            <div className="text-8xl mb-6 group-hover:scale-110 transition-transform">⚔️</div>
            <h2 className="text-4xl font-black mb-3">PLAY SOLO</h2>
            <p className="text-slate-300">Jump into battle alone</p>
          </button>

          {/* Create/Manage Team */}
          <button
            onClick={() => setShowTeamsList(true)}
            className="group relative bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/30 rounded-3xl p-12 hover:scale-105 transition-all duration-500 hover:border-blue-500"
          >
            <div className="text-8xl mb-6 group-hover:scale-110 transition-transform">👥</div>
            <h2 className="text-4xl font-black mb-3">MY TEAMS</h2>
            <p className="text-slate-300">Manage your squads</p>
          </button>

          {/* Join Team */}
          <button
            onClick={() => setShowJoinTeams(true)}
            className="group relative bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-2 border-green-500/30 rounded-3xl p-12 hover:scale-105 transition-all duration-500 hover:border-green-500"
          >
            <div className="text-8xl mb-6 group-hover:scale-110 transition-transform">🤝</div>
            <h2 className="text-4xl font-black mb-3">JOIN TEAM</h2>
            <p className="text-slate-300">Find a team to join</p>
          </button>
        </div>

        {/* SOLO QUEUE MODAL */}
        {showSoloModal && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn"
            onClick={() => setShowSoloModal(false)}
          >
            <div 
              className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-purple-500/30 animate-scaleIn"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-black text-purple-300">SOLO QUEUE</h3>
                <button 
                  onClick={() => setShowSoloModal(false)}
                  className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Topic */}
                <div>
                  <label className="text-sm font-semibold text-purple-300 mb-2 block">Topic *</label>
                  <select
                    value={soloQueueData.topic}
                    onChange={(e) => setSoloQueueData({...soloQueueData, topic: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Select topic</option>
                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Game Mode */}
                <div>
                  <label className="text-sm font-semibold text-purple-300 mb-2 block">Game Mode *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['quiz', 'debate', 'discussion'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setSoloQueueData({...soloQueueData, gameMode: mode})}
                        className={`py-2 rounded-xl font-bold capitalize transition-all ${
                          soloQueueData.gameMode === mode
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Player Count */}
                <div>
                  <label className="text-sm font-semibold text-purple-300 mb-2 block">Team Size *</label>
                  <select
                    value={soloQueueData.playerCount}
                    onChange={(e) => setSoloQueueData({...soloQueueData, playerCount: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value={1}>1 Player (Solo)</option>
                    <option value={2}>2 Players (Find +1)</option>
                    <option value={3}>3 Players (Find +2)</option>
                    <option value={4}>4 Players (Find +3)</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-2">
                    {soloQueueData.playerCount === 1 
                      ? 'You will play alone' 
                      : `System will find ${soloQueueData.playerCount - 1} random player(s)`}
                  </p>
                </div>
                 <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                      Choose your Opponent 
                      </label>
                    <div className="flex flex-wrap gap-2">
                   {['solo', 'duo', 'trio', 'squad', 'default'].map(mode => (
                 <button
                   key={mode}
                  onClick={() => setSoloQueueData({...soloQueueData, opponentType: mode})}
                   className={`px-4 py-2 rounded-xl capitalize ${
                     soloQueueData.opponentType === mode ? 'bg-purple-600' : 'bg-slate-800'
                        }`}
                        >
                               {mode}
                             </button>
                                ))}
                         </div>
                     </div>
                {/* Question Count */}
                <div>
                  <label className="text-sm font-semibold text-purple-300 mb-2 block">
                    {soloQueueData.gameMode === 'debate' ? 'Chances' : 'Questions'} *
                  </label>
                  <select
                    value={soloQueueData.questionCount}
                    onChange={(e) => setSoloQueueData({...soloQueueData, questionCount: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* Stance (Debate only) */}
                {soloQueueData.gameMode === 'debate' && (
                  <div>
                    <label className="text-sm font-semibold text-purple-300 mb-2 block">Stance *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['for', 'against'].map(s => (
                        <button
                          key={s}
                          onClick={() => setSoloQueueData({...soloQueueData, stance: s})}
                          className={`py-2 rounded-xl font-bold capitalize transition-all ${
                            soloQueueData.stance === s
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSoloQueue}
                  disabled={!socket || !user ||!soloQueueData.topic || !soloQueueData.gameMode || isQueuing}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!user ? 'Loading...' : isQueuing ? 'SEARCHING...' : 'FIND MATCH'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEAM MANAGEMENT MODAL */}
        <TeamManagementModal 
          show={showTeamsList} 
          onClose={() => setShowTeamsList(false)} 
          socket={socket}
          user={user}
        />

        {/* JOIN TEAMS MODAL */}
        <JoinTeamsModal 
          show={showJoinTeams} 
          onClose={() => setShowJoinTeams(false)} 
        />
      </div>
    </div>
  );
}