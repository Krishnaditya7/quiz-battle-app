import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function JoinTeamsModal({ show, onClose }) {
  const [searchTopic, setSearchTopic] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (show) {
      fetchAvailableTeams();
    }
  }, [show, searchTopic]);

  const fetchAvailableTeams = async () => {
    setLoading(true);
    try {
      const url = searchTopic 
        ? `http://localhost:5000/api/team/browse?topic=${searchTopic}`
        : `http://localhost:5000/api/team/browse`;
      
      const res = await axios.get(url, { withCredentials: true });
      setAvailableTeams(res.data.teams || []);
    } catch (err) {
      console.error('Browse teams error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async (teamId) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/team/${teamId}/join-request`,
        {},
        { withCredentials: true }
      );

      if (res.data.success) {
        alert('Join request sent! Wait for team leader to approve.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    }
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-3xl p-8 max-w-4xl w-full border-2 border-green-500/30 max-h-[90vh] overflow-y-auto animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-4xl font-black text-green-300">JOIN A TEAM</h2>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-2xl transition-all"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by topic (Physics, Chemistry, Math...)"
              value={searchTopic}
              onChange={(e) => setSearchTopic(e.target.value)}
              className="w-full px-6 py-4 pl-14 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">
              🔍
            </div>
            {searchTopic && (
              <button
                onClick={() => setSearchTopic('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-all"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-2 px-2">
            {searchTopic 
              ? `Searching for teams with topic: ${searchTopic}` 
              : `Showing teams based on your interests: ${user?.topics?.join(', ') || 'All topics'}`
            }
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Searching for teams...</p>
          </div>
        )}

        {/* Teams List */}
        {!loading && (
          <div className="space-y-4">
            {availableTeams.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-xl mb-2">No teams found</p>
                <p className="text-sm">Try searching for different topics or create your own team!</p>
              </div>
            ) : (
              availableTeams.map(team => (
                <div 
                  key={team._id}
                  className="bg-slate-800/50 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/50 hover:bg-slate-800/70 transition-all group"
                >
                  <div className="flex items-start gap-6">
                    {/* Team Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-3xl flex-shrink-0">
                      {team.dp ? (
                        <img src={team.dp} alt={team.name} className="w-full h-full rounded-2xl object-cover" />
                      ) : (
                        '🛡️'
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-2xl font-black text-white mb-1 group-hover:text-green-300 transition-colors">
                            {team.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              ⚡ Level {team.level}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              👥 {team.members?.length}/{team.maxMembers} members
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              🏆 {team.totalWon || 0} wins
                            </span>
                          </div>
                        </div>

                        {/* Join Button */}
                        <button
                          onClick={() => handleJoinRequest(team._id)}
                          className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 flex items-center gap-2"
                        >
                          <span className="text-xl">➕</span>
                          Request Join
                        </button>
                      </div>

                      {/* Topics */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {team.topics?.map(topic => (
                          <span 
                            key={topic}
                            className={`px-3 py-1 rounded-full text-sm ${
                              searchTopic.toLowerCase() === topic.toLowerCase()
                                ? 'bg-green-600/50 border-2 border-green-400 text-green-200 font-bold'
                                : 'bg-green-600/20 border border-green-500/30 text-green-300'
                            }`}
                          >
                            {topic}
                          </span>
                        ))}
                      </div>

                      {/* Requirements */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`${
                          user?.level >= team.minPlayerLevelRequired 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          {user?.level >= team.minPlayerLevelRequired ? '✓' : '✗'} 
                          {' '}Min Level: {team.minPlayerLevelRequired}
                        </span>
                        
                        {team.members?.length >= team.maxMembers ? (
                          <span className="text-orange-400">⚠️ Team Full</span>
                        ) : (
                          <span className="text-green-400">✓ Spots Available</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Helpful Tip */}
        <div className="mt-8 bg-green-600/10 border border-green-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h4 className="font-bold text-green-300 mb-2">Pro Tip</h4>
              <p className="text-sm text-slate-300">
                Teams with topics matching your interests have a higher chance of accepting you. 
                Make sure you meet the minimum level requirement before requesting to join!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}