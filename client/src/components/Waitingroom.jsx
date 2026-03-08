import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { queueData, myTeam } = location.state || {};
  
  const [socket, setSocket] = useState(null);
  const [matchFound, setMatchFound] = useState(false);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      withCredentials: true
    });

    newSocket.on('match:found', (data) => {
      setMatchFound(true);
      setOpponentTeam(data);
      
      // 3 second countdown before game starts
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(timer);
          navigate('/game-room', { state: { gameData: data } });
        }
      }, 1000);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [navigate]);

  const handleLeaveQueue = async () => {
    if (socket) {
      socket.emit('queue:leave');
    }
    navigate('/game');
  };

  // Generate placeholder avatars for scrolling animation
  const placeholderAvatars = ['🥷', '👑', '🔥', '⚡', '💀', '🎯', '🛡️', '⚔️'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white flex items-center justify-center p-8">
      <div className="max-w-7xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {matchFound ? 'MATCH FOUND!' : 'FINDING OPPONENTS...'}
          </h1>
          <p className="text-2xl text-slate-300">
            {matchFound ? `Game starts in ${countdown}...` : 'Hang tight, warrior!'}
          </p>
        </div>

        {/* Main Battle Area */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-8 items-center">
            {/* MY TEAM (Right Side) */}
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-center text-purple-300 mb-6">YOUR TEAM</h3>
              {Array.from({ length: queueData?.playerCount || 1 }).map((_, index) => (
                <div
                  key={index}
                  className={`bg-slate-800/50 border-2 ${
                    matchFound ? 'border-green-500' : 'border-purple-500'
                  } rounded-2xl p-6 hover:scale-105 transition-all duration-500 animate-slideInRight`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl shadow-lg">
                      {myTeam?.members?.[index]?.avatar || '👤'}
                    </div>
                    
                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="font-bold text-lg">
                        {myTeam?.members?.[index]?.username || `Player ${index + 1}`}
                      </div>
                      <div className="text-sm text-slate-400">
                        Level {myTeam?.members?.[index]?.level || '?'}
                      </div>
                    </div>

                    {/* Status */}
                    <div className={`w-3 h-3 rounded-full ${
                      matchFound ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-ping'
                    }`} />
                  </div>
                </div>
              ))}
            </div>

            {/* VS / WITH Center */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <div className={`text-8xl font-black ${
                  matchFound ? 'text-green-400 scale-125' : 'text-purple-400'
                } transition-all duration-500`}>
                  {queueData?.gameMode === 'discussion' ? 'WITH' : 'VS'}
                </div>
                
                {!matchFound && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-8 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {matchFound && countdown && (
                  <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-6xl font-black text-green-400 animate-bounce">
                    {countdown}
                  </div>
                )}
              </div>

              {/* Topic Info */}
              <div className="mt-8 text-center bg-slate-800/50 rounded-2xl p-6 border border-purple-500/30">
                <div className="text-sm text-slate-400 mb-2">Topic</div>
                <div className="text-2xl font-black text-purple-300">{queueData?.topic}</div>
                <div className="text-sm text-slate-400 mt-2">
                  {queueData?.gameMode?.toUpperCase()} • {queueData?.questionCount} Questions
                </div>
              </div>
            </div>

            {/* OPPONENT TEAM (Left Side) */}
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-center text-orange-300 mb-6">OPPONENTS</h3>
              
              {!matchFound ? (
                // Scrolling animation when searching
                Array.from({ length: parseInt(queueData?.opponentType?.replace(/\D/g, '') || 1) }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border-2 border-dashed border-orange-500/50 rounded-2xl p-6 overflow-hidden relative h-24"
                  >
                    <div className="absolute inset-0 flex flex-col animate-scrollUp">
                      {placeholderAvatars.map((avatar, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 h-24 px-6 opacity-50"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-3xl">
                            {avatar}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-slate-400">???</div>
                            <div className="text-sm text-slate-500">Searching...</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Show matched opponents
                opponentTeam?.teamBMembers?.map((opponent, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border-2 border-green-500 rounded-2xl p-6 hover:scale-105 transition-all duration-500 animate-slideInLeft"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-3xl shadow-lg">
                        {opponent.avatar || '👤'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-bold text-lg">{opponent.username}</div>
                        <div className="text-sm text-slate-400">Level {opponent.level}</div>
                      </div>

                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        {!matchFound && (
          <div className="text-center mt-12">
            <button
              onClick={handleLeaveQueue}
              className="px-12 py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-lg transition-all hover:scale-105"
            >
              LEAVE QUEUE
            </button>
          </div>
        )}

        {/* Queue Stats */}
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-sm text-slate-400">Queue Time</div>
            <div className="text-2xl font-black text-purple-300">
              {/* Add timer here */}
              0:32
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm text-slate-400">Players in Queue</div>
            <div className="text-2xl font-black text-purple-300">
              {/* Dynamic count */}
              12
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">🎮</div>
            <div className="text-sm text-slate-400">Active Games</div>
            <div className="text-2xl font-black text-purple-300">
              {/* Dynamic count */}
              8
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}