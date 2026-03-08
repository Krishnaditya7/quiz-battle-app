import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

export default function GameRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameData } = location.state || {};
  
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    currentTurn: null,
    currentQuestion: null,
    timer: 0,
    teamAScore: 0,
    teamBScore: 0,
    questionsRemaining: gameData?.totalQuestions || 10,
    playerScores: {},
  });

  const [myTeam, setMyTeam] = useState(gameData?.teamAMembers || []);
  const [opponentTeam, setOpponentTeam] = useState(gameData?.teamBMembers || []);
  
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(null);
  const [generateVotes, setGenerateVotes] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const videoRefs = useRef({});

  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      withCredentials: true
    });

    // Socket listeners
    newSocket.on('game:started', (data) => {
      console.log('Game started!', data);
    });

    newSocket.on('game:turnChanged', (data) => {
      setGameState(prev => ({ ...prev, currentTurn: data.userId }));
    });

    newSocket.on('game:questionAsked', (data) => {
      setGameState(prev => ({ 
        ...prev, 
        currentQuestion: data.question,
        timer: 10 // Pin timer
      }));
    });

    newSocket.on('game:scoreUpdate', (data) => {
      setGameState(prev => ({
        ...prev,
        teamAScore: data.teamAScore,
        teamBScore: data.teamBScore,
        playerScores: data.playerScores
      }));
    });

    newSocket.on('game:ended', (data) => {
      navigate('/game-results', { state: { results: data } });
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [navigate]);

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave? You\'ll lose the match!')) {
      socket?.emit('game:leave', { gameId: gameData.gameId });
      navigate('/dashboard');
    }
  };

  const handleGenerateQuestion = () => {
    socket?.emit('game:requestNextQuestion', { 
      gameId: gameData.gameId,
      userId: 'currentUserId' // Replace with actual
    });
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      socket?.emit('game:chat', {
        gameId: gameData.gameId,
        message: newMessage
      });
      setMessages([...messages, { from: 'You', text: newMessage }]);
      setNewMessage('');
    }
  };

  const isMyTurn = (playerId) => {
    return gameState.currentTurn === playerId;
  };

  const isDiscussion = gameData?.gameMode === 'discussion';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white flex flex-col">
      {/* Main Game Area */}
      <div className="flex-1 grid grid-cols-[300px_1fr_300px] gap-6 p-6">
        {/* LEFT: My Team */}
        <div className="space-y-4">
          <h3 className="text-xl font-black text-purple-300 text-center mb-4">YOUR TEAM</h3>
          {myTeam.map((player, index) => (
            <div
              key={player._id}
              className={`relative group ${
                isMyTurn(player._id) ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-slate-950' : ''
              }`}
            >
              {/* Player Box */}
              <div className="bg-slate-800/50 border-2 border-purple-500/50 rounded-2xl p-4 hover:border-purple-500 transition-all cursor-pointer"
                   onClick={() => setShowPlayerStats(player)}>
                {/* Video/Avatar */}
                {videoEnabled && player.videoStream ? (
                  <video
                    ref={el => videoRefs.current[player._id] = el}
                    autoPlay
                    muted={player._id === 'myId'} // Mute self
                    className="w-full aspect-square rounded-xl object-cover mb-3"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-5xl mb-3">
                    {player.avatar || '👤'}
                  </div>
                )}

                {/* Player Info */}
                <div className="text-center">
                  <div className="font-bold truncate">{player.username}</div>
                  <div className="text-sm text-slate-400">Lvl {player.level}</div>
                  <div className="text-lg font-black text-purple-300 mt-2">
                    {gameState.playerScores[player._id] || 0} pts
                  </div>
                </div>

                {/* Turn Indicator */}
                {isMyTurn(player._id) && !isDiscussion && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm font-black animate-pulse shadow-lg shadow-green-500/50">
                    ⚡
                  </div>
                )}

                {/* Score +1 Animation */}
                {/* Add when player scores */}
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: Game Action Area */}
        <div className="flex flex-col">
          {/* Score Circle */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-32 h-32">
              {/* Circle with half colors */}
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="url(#gradient1)"
                  strokeWidth="16"
                  strokeDasharray="176 176"
                />
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Scores */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-sm font-bold text-purple-300">{gameState.teamAScore}</div>
                  <div className="text-xs text-slate-500">:</div>
                  <div className="text-sm font-bold text-orange-300">{gameState.teamBScore}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Action Box */}
          {!isDiscussion && gameState.currentTurn ? (
            // Show current player big
            <div className="flex-1 bg-slate-800/50 border-2 border-purple-500 rounded-3xl p-8 flex flex-col items-center justify-center mb-6">
              <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-8xl mb-6 shadow-2xl shadow-purple-500/50">
                {/* Current turn player avatar */}
                👑
              </div>
              <div className="text-3xl font-black mb-2">Player's Turn</div>
              <div className="text-lg text-slate-400">Asking question...</div>
              
              {/* Timer */}
              {gameState.timer > 0 && (
                <div className="mt-6 text-6xl font-black text-green-400 animate-pulse">
                  {gameState.timer}s
                </div>
              )}
            </div>
          ) : isDiscussion ? (
            // Discussion: Generate Question Button
            <div className="flex-1 bg-slate-800/50 border-2 border-blue-500 rounded-3xl p-8 flex flex-col items-center justify-center mb-6">
              <div className="text-6xl mb-6">💬</div>
              <h3 className="text-3xl font-black mb-4">Discussion Mode</h3>
              <p className="text-slate-400 mb-8 text-center max-w-md">
                Everyone must click to generate the next question
              </p>
              
              <button
                onClick={handleGenerateQuestion}
                className="px-12 py-6 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105"
              >
                GENERATE NEW QUESTION
              </button>

              <div className="mt-6 text-sm text-slate-400">
                Votes: {generateVotes.size} / {myTeam.length + opponentTeam.length}
              </div>
            </div>
          ) : (
            // Waiting for game to start
            <div className="flex-1 bg-slate-800/50 border-2 border-purple-500/50 rounded-3xl p-8 flex items-center justify-center mb-6">
              <div className="text-center">
                <div className="text-6xl mb-6 animate-bounce">⏳</div>
                <div className="text-2xl font-black text-slate-300">Game Starting Soon...</div>
              </div>
            </div>
          )}

          {/* Current Question Display */}
          {gameState.currentQuestion && (
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-purple-500/50 rounded-2xl p-6 mb-6 animate-fadeIn">
              <div className="text-sm text-purple-300 font-bold mb-2">CURRENT QUESTION:</div>
              <div className="text-xl font-bold">{gameState.currentQuestion}</div>
            </div>
          )}
        </div>

        {/* RIGHT: Opponent Team */}
        <div className="space-y-4">
          <h3 className="text-xl font-black text-orange-300 text-center mb-4">OPPONENTS</h3>
          {opponentTeam.map((player, index) => (
            <div
              key={player._id}
              className={`relative group ${
                isMyTurn(player._id) ? 'ring-4 ring-yellow-500 ring-offset-4 ring-offset-slate-950' : ''
              }`}
            >
              {/* Player Box */}
              <div className="bg-slate-800/50 border-2 border-orange-500/50 rounded-2xl p-4 hover:border-orange-500 transition-all cursor-pointer"
                   onClick={() => setShowPlayerStats(player)}>
                {/* Video/Avatar */}
                {videoEnabled && player.videoStream ? (
                  <video
                    ref={el => videoRefs.current[player._id] = el}
                    autoPlay
                    className="w-full aspect-square rounded-xl object-cover mb-3"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-5xl mb-3">
                    {player.avatar || '👤'}
                  </div>
                )}

                {/* Player Info */}
                <div className="text-center">
                  <div className="font-bold truncate">{player.username}</div>
                  <div className="text-sm text-slate-400">Lvl {player.level}</div>
                  <div className="text-lg font-black text-orange-300 mt-2">
                    {gameState.playerScores[player._id] || 0} pts
                  </div>
                </div>

                {/* Turn Indicator */}
                {isMyTurn(player._id) && !isDiscussion && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-sm font-black animate-pulse shadow-lg shadow-yellow-500/50">
                    ⚡
                  </div>
                )}

                {/* Action Icons (Report + Add Friend) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button className="w-8 h-8 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-sm transition-all">
                    🚫
                  </button>
                  <button className="w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-sm transition-all">
                    ➕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-t border-purple-500/20 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Media Controls */}
          <div className="flex gap-4">
            <button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                videoEnabled 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              📹
            </button>

            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                voiceEnabled 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              🎤
            </button>

            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-14 h-14 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-2xl transition-all relative"
            >
              💬
              {messages.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {messages.length}
                </div>
              )}
            </button>
          </div>

          {/* Center: Game Info */}
          <div className="flex gap-8 items-center">
            <div className="bg-slate-800/50 px-6 py-3 rounded-xl border border-purple-500/30">
              <div className="text-sm text-slate-400">Questions Left</div>
              <div className="text-2xl font-black text-purple-300">{gameState.questionsRemaining}</div>
            </div>

            <div className="bg-slate-800/50 px-6 py-3 rounded-xl border border-purple-500/30">
              <div className="text-sm text-slate-400">Your Score</div>
              <div className="text-2xl font-black text-green-400">
                {gameState.playerScores['myId'] || 0}
              </div>
            </div>
          </div>

          {/* Right: Leave Button */}
          <button
            onClick={handleLeaveGame}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all hover:scale-105"
          >
            LEAVE GAME
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      {chatOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-purple-500/20 shadow-2xl z-50 flex flex-col animate-slideInRight">
          <div className="p-6 border-b border-purple-500/20 flex justify-between items-center">
            <h3 className="text-2xl font-black">Chat</h3>
            <button onClick={() => setChatOpen(false)} className="text-2xl hover:text-red-400">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-sm font-bold text-purple-300">{msg.from}</div>
                <div className="text-white">{msg.text}</div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t border-purple-500/20">
            <div className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
              <button
                onClick={handleSendMessage}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Stats Modal */}
      {showPlayerStats && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowPlayerStats(null)}
        >
          <div 
            className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-purple-500/30 animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-6xl mx-auto mb-4">
                {showPlayerStats.avatar || '👤'}
              </div>
              <h3 className="text-3xl font-black mb-2">{showPlayerStats.username}</h3>
              <div className="text-slate-400">Level {showPlayerStats.level}</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between bg-slate-800/50 p-4 rounded-xl">
                <span className="text-slate-400">XP</span>
                <span className="font-bold">{showPlayerStats.xp || 0}</span>
              </div>
              <div className="flex justify-between bg-slate-800/50 p-4 rounded-xl">
                <span className="text-slate-400">Games Played</span>
                <span className="font-bold">{showPlayerStats.stats?.gamesPlayed || 0}</span>
              </div>
              <div className="flex justify-between bg-slate-800/50 p-4 rounded-xl">
                <span className="text-slate-400">Wins</span>
                <span className="font-bold text-green-400">{showPlayerStats.stats?.wins || 0}</span>
              </div>
              <div className="flex justify-between bg-slate-800/50 p-4 rounded-xl">
                <span className="text-slate-400">Win Rate</span>
                <span className="font-bold text-purple-400">
                  {showPlayerStats.stats?.gamesPlayed 
                    ? Math.round((showPlayerStats.stats.wins / showPlayerStats.stats.gamesPlayed) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowPlayerStats(null)}
              className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}