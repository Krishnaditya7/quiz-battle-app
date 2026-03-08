import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function GameResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const { results } = location.state || {};

  const allPlayers = [
    ...(results?.teamA || []),
    ...(results?.teamB || [])
  ].sort((a, b) => b.finalScore - a.finalScore);

  const mvp = allPlayers[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-8">
      {/* Winner + MVP + Leaderboard */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-7xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            {results?.result === 'win' ? 'VICTORY!' : 'GAME OVER'}
          </h1>
        </div>

        {/* MVP with Crown */}
        <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-3xl p-8 mb-12">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-8xl animate-bounce">
            👑
          </div>
          <div className="text-center mt-8">
            <div className="text-4xl font-black mb-4">{mvp?.username}</div>
            <div className="text-3xl font-black text-yellow-400">{mvp?.finalScore} points</div>
          </div>
        </div>

        {/* All Players */}
        <div className="space-y-3">
          {allPlayers.map((player, index) => (
            <div key={player._id} className={`flex items-center gap-6 p-6 rounded-2xl ${
              index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-slate-800/50'
            }`}>
              <div className="text-3xl font-black">{index + 1}</div>
              <div className="text-3xl">{player.avatar || '👤'}</div>
              <div className="flex-1">
                <div className="text-xl font-bold">{player.username}</div>
                <div className="text-sm text-slate-400">Level {player.level}</div>
              </div>
              <div className="text-3xl font-black text-purple-400">{player.finalScore}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center mt-12">
          <button onClick={() => navigate('/game')} className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl font-bold text-xl">
            PLAY AGAIN
          </button>
          <button onClick={() => navigate('/dashboard')} className="px-12 py-4 bg-slate-700 rounded-2xl font-bold text-xl">
            DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
}