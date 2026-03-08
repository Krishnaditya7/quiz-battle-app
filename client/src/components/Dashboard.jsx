import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bio, setBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
    fetchGameHistory();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        withCredentials: true
      });
      if (res.data.success) {
        setUser(res.data.user);
        setBio(res.data.user.bio || '');
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const fetchGameHistory = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/game/history', {
        withCredentials: true
      });
      if (res.data.success) {
        setGameHistory(res.data.games || []);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  };

  const handleUpdateBio = async () => {
    try {
      const res = await axios.patch(
        'http://localhost:5000/api/auth/update-bio',
        { bio },
        { withCredentials: true }
      );
      if (res.data.success) {
        alert('Bio updated!');
        setEditingBio(false);
        fetchUserData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update bio');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout', {}, {
        withCredentials: true
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all"
          >
            ← Home
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr] gap-8">
          {/* LEFT SIDEBAR - Profile Card */}
          <div className="bg-slate-900/50 border border-purple-500/20 rounded-3xl p-6 h-fit">
            {/* Profile Picture */}
            <div className="relative mb-6">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-6xl shadow-2xl">
                {user?.profilePic || '👤'}
              </div>
              {/* Edit button for profile pic - future feature */}
            </div>

            {/* Username */}
            <div className="text-center mb-2">
              <h2 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {user?.username}
              </h2>
            </div>

            {/* User ID */}
            <div className="text-center mb-6">
              <p className="text-slate-400 text-sm">
                ID: {user?._id?.slice(-8).toUpperCase()}
              </p>
            </div>

            {/* Level & XP */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-purple-400">{user?.level || 1}</div>
                <div className="text-xs text-slate-400">Level</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-pink-400">{user?.xp || 0}</div>
                <div className="text-xs text-slate-400">XP</div>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-purple-300">BIO</h3>
                <button
                  onClick={() => setEditingBio(!editingBio)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  {editingBio ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    placeholder="Write about yourself..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm resize-none"
                    rows={4}
                  />
                  <button
                    onClick={handleUpdateBio}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold"
                  >
                    Save Bio
                  </button>
                </div>
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed">
                  {user?.bio || 'No bio yet. Click edit to add one!'}
                </p>
              )}
            </div>

            {/* Class */}
            <div className="bg-slate-800/30 rounded-xl p-4 mb-4">
              <div className="text-xs text-slate-400 mb-1">CLASS</div>
              <div className="text-lg font-bold">Class {user?.class || 'N/A'}</div>
            </div>

            {/* Topics */}
            <div className="bg-slate-800/30 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-2">TOPICS</div>
              <div className="flex flex-wrap gap-2">
                {user?.topics?.map((topic, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded-full text-xs"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Stats & Games */}
          <div className="space-y-8">
            {/* Stats Grid */}
            <div>
              <h3 className="text-3xl font-black mb-6 text-purple-300">STATS</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/50 transition-all">
                  <div className="text-4xl mb-2">🎮</div>
                  <div className="text-3xl font-black text-purple-400">
                    {user?.stats?.gamesPlayed || 0}
                  </div>
                  <div className="text-slate-400 text-sm">Games</div>
                </div>

                <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/50 transition-all">
                  <div className="text-4xl mb-2">🏆</div>
                  <div className="text-3xl font-black text-green-400">
                    {user?.stats?.wins || 0}
                  </div>
                  <div className="text-slate-400 text-sm">Wins</div>
                </div>

                <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-6 hover:border-red-500/50 transition-all">
                  <div className="text-4xl mb-2">💀</div>
                  <div className="text-3xl font-black text-red-400">
                    {user?.stats?.losses || 0}
                  </div>
                  <div className="text-slate-400 text-sm">Losses</div>
                </div>

                <div className="bg-slate-900/50 border border-yellow-500/20 rounded-2xl p-6 hover:border-yellow-500/50 transition-all">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-3xl font-black text-yellow-400">
                    {user?.stats?.gamesPlayed > 0
                      ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100)
                      : 0}%
                  </div>
                  <div className="text-slate-400 text-sm">Win Rate</div>
                </div>
              </div>
            </div>

            {/* Friends Section */}
            <div>
              <h3 className="text-3xl font-black mb-6 text-purple-300">FRIENDS</h3>
              <div className="bg-slate-900/50 border border-purple-500/20 rounded-2xl p-8">
                <div className="text-center text-slate-400">
                  <div className="text-6xl mb-4">👥</div>
                  <p>Friends feature coming soon...</p>
                </div>
              </div>
            </div>

            {/* Games Played (History) */}
            <div>
              <h3 className="text-3xl font-black mb-6 text-purple-300">GAMES PLAYED</h3>
              <div className="bg-slate-900/50 border border-purple-500/20 rounded-2xl p-6">
                {gameHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-6xl mb-4">🎯</div>
                    <p className="text-xl font-bold mb-2">No games yet!</p>
                    <p>Start playing to see your match history</p>
                    <button
                      onClick={() => navigate('/game')}
                      className="mt-6 px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all"
                    >
                      Play Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gameHistory.slice(0, 10).map((game, index) => (
                      <div
                        key={game._id || index}
                        className="bg-slate-800/50 rounded-xl p-4 hover:bg-slate-800/70 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-lg">
                              {game.gameMode?.toUpperCase()} - {game.topic}
                            </div>
                            <div className="text-sm text-slate-400">
                              {new Date(game.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-black ${
                              game.result === 'win' ? 'text-green-400' :
                              game.result === 'loss' ? 'text-red-400' :
                              'text-yellow-400'
                            }`}>
                              {game.result === 'win' ? '🏆 WIN' :
                               game.result === 'loss' ? '💀 LOSS' :
                               '🤝 DRAW'}
                            </div>
                            <div className="text-sm text-slate-400">
                              {game.yourScore || 0} points
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}