import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function WaitingRoom({ socket, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { queueData, myTeam: initialMyTeam, isCollab: initialIsCollab, collabSlots: initialCollabSlots } = location.state || {};

  // ── Core match state ──
  const [matchFound, setMatchFound]     = useState(false);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [countdown, setCountdown]       = useState(null);
  const [queueTime, setQueueTime]       = useState(0);

  // ── Collab state ──
  // Phase 1 — "Finding teammates":  isCollab=true,  collabTeamReady=false
  // Phase 2 — "Finding opponent":   isCollab=true,  collabTeamReady=true
  // Regular  — "Finding opponent":  isCollab=false, collabTeamReady=false (irrelevant)
  const [isCollab, setIsCollab]               = useState(initialIsCollab || false);
  const [collabTeamReady, setCollabTeamReady] = useState(false);
  const [collabSlots, setCollabSlots]         = useState(initialCollabSlots || null); // { filled, total }
  const [myTeam, setMyTeam]                   = useState(initialMyTeam || null);

  const placeholderAvatars = ['🥷', '👑', '🔥', '⚡', '💀', '🎯', '🛡️', '⚔️'];

  // ── Queue timer ──
  useEffect(() => {
    const timer = setInterval(() => setQueueTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;

    // ── Collab Phase 1: slot-fill progress update ──
    // Fired when a new player joins the collab pool but team isn't full yet
    // e.g. { filled: 2, total: 4, message: 'Finding teammates... 2/4 joined' }
    socket.on('match:collabUpdate', ({ filled, total }) => {
      setCollabSlots({ filled, total });
    });

    // ── Collab Phase 2: temp team is fully assembled, now searching for opponent ──
    // Fired once the collab group is complete and they enter the regular match queue
    // e.g. { myTeam: { name, members: [...] }, queueData: {...} }
    socket.on('match:collabTeamReady', ({ myTeam: assembledTeam }) => {
      setCollabTeamReady(true);   // flip to phase 2
      setMyTeam(assembledTeam);   // show all assembled teammates
      // collabSlots no longer needed — team is full
      setCollabSlots(prev => prev ? { ...prev, filled: prev.total } : prev);
    });

    // ── Match found (works for both regular and collab) ──
    socket.on('match:found', (data) => {
      setMatchFound(true);
      setOpponentTeam(data);
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

    // ── Queue left (leader left or disconnected teammate) ──
    socket.on('queue:left', (data) => {
      navigate(data?.redirect || '/game');
    });

    socket.on('error', (data) => {
      alert(data.message);
    });

    return () => {
      socket.off('match:collabUpdate');
      socket.off('match:collabTeamReady');
      socket.off('match:found');
      socket.off('queue:left');
      socket.off('error');
    };
  }, [socket]);

  // ── Leave queue ──
  const handleLeaveQueue = () => {
    if (!socket || !user || !queueData) {
      navigate('/game');
      return;
    }
    socket.emit('queue:leave', {
      userId: user._id,
      topic: queueData.topic,
      questionCount: queueData.questionCount,
    });
    navigate('/game');
  };

  // Leader = first member in myTeam, or the user themselves if solo
  const isLeader = myTeam?.members?.length > 0
    ? myTeam.members[0].username === user?.username
    : true;

  // ── Derived display values ──

  // Header title — 3 possible states
  const headerTitle = matchFound
    ? 'MATCH FOUND!'
    : isCollab && !collabTeamReady
      ? 'FINDING TEAMMATES...'
      : 'FINDING OPPONENTS...';

  // Header subtitle
  const headerSub = matchFound
    ? `Game starts in ${countdown}...`
    : isCollab && !collabTeamReady
      ? collabSlots
        ? `${collabSlots.filled} of ${collabSlots.total} teammates joined`
        : 'Assembling your team...'
      : 'Hang tight, warrior!';

  // Center label — changes per phase
  const centerLabel = matchFound
    ? 'VS'
    : isCollab && !collabTeamReady
      ? 'ASSEMBLING'
      : 'VS';

  // Opponent placeholder count — how many slots to animate
  // For default opponentType show 1 placeholder; named types (solo/duo/trio/squad) show their count
  const opponentPlaceholderCount = (() => {
    const type = queueData?.opponentType;
    const map = { solo: 1, duo: 2, trio: 3, squad: 4 };
    return map[type] || 1;
  })();

  // My team display members — show filled slots + empty placeholder slots while assembling
  const myTeamMembers  = myTeam?.members || [{ username: user?.username, level: user?.level, avatar: '👤' }];
  const totalSlots     = collabSlots?.total || myTeamMembers.length;
  const emptySlots     = isCollab && !collabTeamReady
    ? Math.max(0, totalSlots - myTeamMembers.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white flex items-center justify-center p-8">
      <div className="max-w-7xl w-full">

        {/* ── Header ── */}
        <div className="text-center mb-12">
          <h1 className={`text-6xl font-black mb-4 bg-gradient-to-r ${
            matchFound
              ? 'from-green-400 to-emerald-400'
              : isCollab && !collabTeamReady
                ? 'from-blue-400 to-cyan-400'
                : 'from-purple-400 to-pink-400'
          } bg-clip-text text-transparent transition-all duration-500`}>
            {headerTitle}
          </h1>
          <p className="text-2xl text-slate-300">{headerSub}</p>

          {/* ── Collab slot progress bar (Phase 1 only) ── */}
          {isCollab && !collabTeamReady && collabSlots && (
            <div className="mt-6 max-w-sm mx-auto">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Teammates found</span>
                <span className="text-blue-400 font-bold">{collabSlots.filled}/{collabSlots.total}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                  style={{ width: `${(collabSlots.filled / collabSlots.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {Array.from({ length: collabSlots.total }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all duration-500 ${
                      i < collabSlots.filled
                        ? 'bg-blue-400 scale-125'
                        : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Collab phase 2 badge ── */}
          {isCollab && collabTeamReady && !matchFound && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Team assembled — searching for opponent
            </div>
          )}
        </div>

        {/* ── Main Battle Area ── */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-8 items-start">

            {/* ── MY TEAM (left panel) ── */}
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-center text-purple-300 mb-6">
                {myTeam?.name ? myTeam.name.toUpperCase() : 'MY TEAM'}
              </h3>

              {/* Confirmed members */}
              {myTeamMembers.map((member, index) => (
                <div
                  key={`member-${index}`}
                  className={`bg-slate-800/50 border-2 ${
                    matchFound ? 'border-green-500' : 'border-purple-500'
                  } rounded-2xl p-6 transition-all duration-500`}
                  style={{ animation: 'slideInLeft 0.4s ease both', animationDelay: `${index * 0.08}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl shadow-lg">
                      {member.avatar || '👤'}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{member.username || `Player ${index + 1}`}</div>
                      <div className="text-sm text-slate-400">Level {member.level || '?'}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      matchFound ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-ping'
                    }`} />
                  </div>
                </div>
              ))}

              {/* Empty slots while assembling collab team */}
              {Array.from({ length: emptySlots }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="bg-slate-800/30 border-2 border-dashed border-blue-500/40 rounded-2xl p-6 transition-all duration-500"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-700/50 border-2 border-dashed border-blue-400/30 flex items-center justify-center text-2xl">
                      ⏳
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-slate-500">Waiting...</div>
                      <div className="text-sm text-slate-600">Finding teammate</div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-blue-500/50 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Center ── */}
            <div className="flex flex-col items-center justify-center pt-16">
              <div className="relative flex items-center justify-center w-40 h-40">

                {/* Spinner — shown while searching (any phase) and no match yet */}
                {!matchFound && (
                  <div className={`absolute w-32 h-32 border-8 border-t-transparent rounded-full animate-spin ${
                    isCollab && !collabTeamReady ? 'border-blue-500' : 'border-purple-500'
                  }`} />
                )}

                <div className={`text-4xl font-black z-10 transition-all duration-500 ${
                  matchFound
                    ? 'text-green-400 scale-125'
                    : isCollab && !collabTeamReady
                      ? 'text-blue-400'
                      : 'text-purple-400'
                }`}>
                  {centerLabel}
                </div>

                {/* Countdown bubble */}
                {matchFound && countdown !== null && (
                  <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-6xl font-black text-green-400 animate-bounce">
                    {countdown}
                  </div>
                )}
              </div>

              {/* Topic card */}
              <div className="mt-20 text-center bg-slate-800/50 rounded-2xl p-6 border border-purple-500/30 w-full">
                <div className="text-sm text-slate-400 mb-1">Topic</div>
                <div className="text-2xl font-black text-purple-300">{queueData?.topic}</div>
                <div className="text-sm text-slate-400 mt-1">{queueData?.questionCount} Questions</div>
                <div className="text-xs text-slate-500 mt-2 capitalize">
                  Team size: {queueData?.playerCount} · Opponent: {queueData?.opponentType}
                </div>
              </div>
            </div>

            {/* ── OPPONENT PANEL (right panel) ── */}
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-center text-orange-300 mb-6">OPPONENTS</h3>

              {!matchFound ? (
                // Animated placeholder slots
                Array.from({ length: opponentPlaceholderCount }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border-2 border-dashed border-orange-500/50 rounded-2xl p-6 overflow-hidden relative h-24"
                  >
                    <div className="absolute inset-0 flex flex-col animate-scrollUp">
                      {placeholderAvatars.map((avatar, i) => (
                        <div key={i} className="flex items-center gap-4 h-24 px-6 opacity-50">
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
                // Matched opponents revealed
                (opponentTeam?.opponentMembers || []).map((opponent, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border-2 border-green-500 rounded-2xl p-6"
                    style={{ animation: 'slideInRight 0.4s ease both', animationDelay: `${index * 0.08}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-3xl">
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

        {/* ── Leave / Cancel button ── */}
        {!matchFound && (
          <div className="text-center mt-12 space-y-2">
            <button
              onClick={handleLeaveQueue}
              disabled={!isLeader}
              className={`px-8 py-3 rounded-xl font-bold transition-all ${
                isLeader
                  ? 'bg-red-600 hover:bg-red-500 hover:scale-105 cursor-pointer'
                  : 'bg-slate-700 cursor-not-allowed opacity-50'
              }`}
            >
              {isLeader ? 'Leave Queue' : 'Only leader can leave'}
            </button>
            {isCollab && !collabTeamReady && (
              <p className="text-xs text-slate-500">
                Leaving will cancel queue for your whole group
              </p>
            )}
          </div>
        )}

        {/* ── Queue Stats ── */}
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-sm text-slate-400">Queue Time</div>
            <div className="text-2xl font-black text-purple-300">{formatTime(queueTime)}</div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm text-slate-400">
              {isCollab && !collabTeamReady ? 'Teammates Found' : 'Players in Queue'}
            </div>
            <div className="text-2xl font-black text-purple-300">
              {isCollab && !collabTeamReady && collabSlots
                ? `${collabSlots.filled}/${collabSlots.total}`
                : myTeamMembers.length}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 text-center border border-purple-500/20">
            <div className="text-3xl mb-2">
              {isCollab && !collabTeamReady ? '🔗' : '🎮'}
            </div>
            <div className="text-sm text-slate-400">
              {isCollab && !collabTeamReady ? 'Mode' : 'Team Size'}
            </div>
            <div className="text-2xl font-black text-purple-300">
              {isCollab && !collabTeamReady ? 'Collab' : queueData?.playerCount}
            </div>
          </div>
        </div>

      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scrollUp {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scrollUp {
          animation: scrollUp 3s linear infinite;
        }
      `}</style>
    </div>
  );
}