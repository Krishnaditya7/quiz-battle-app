import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import TeamManagementModal from './CreateTeam';
import JoinTeamsModal from './JoinTeam';
import { BACKEND_URL } from "../config";

// ─────────────────────────────────────────────
// Hook: fetch AI-generated trending topics from backend
// Backend hits GNews → Gemini → Redis (see Topicservice.js)
// ─────────────────────────────────────────────
function useTrendingTopics() {
  const [aiTopics, setAiTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/topics/gettopic`)
      .then(res => {
        if (res.data.success) setAiTopics(res.data.topics || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { aiTopics, loading };
}

export default function GamePage({ socket, user }) {
  const navigate = useNavigate();

  const [showSoloModal, setShowSoloModal] = useState(false);
  const [showTeamsList, setShowTeamsList] = useState(false);
  const [showJoinTeams, setShowJoinTeams] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);

  const [soloQueueData, setSoloQueueData] = useState({
    Games: 'Discussion',
    topic: '',
    questionCount: 10,
    playerCount: 1,
    opponentType: 'default'
  });

  const { aiTopics, loading: topicsLoading } = useTrendingTopics();
const Genre = [
  "Horror",
  "Comedy",
  "Sci-Fi",
  "Rom-Com",
  "Family Drama",
  "Action",
  "Thriller"
];
  const handleSoloQueue = () => {
    if (!socket) {
      alert('Not connected to server!');
      return;
    }
    setIsQueuing(true);
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
      Games: soloQueueData.Games,
      topic: soloQueueData.topic,
      questionCount: soloQueueData.questionCount,
      playerCount: soloQueueData.playerCount,
      opponentType: soloQueueData.opponentType,
      teamId: null,
      onlineTeamMembers: [],
    });
  };

  const modes = [
    {
      icon: '⚔️',
      label: 'PLAY SOLO',
      sub: 'Jump into battle alone',
      accent: '#a855f7',
      accentDim: 'rgba(168,85,247,0.08)',
      border: 'rgba(168,85,247,0.2)',
      hoverBorder: 'rgba(168,85,247,0.6)',
      glow: 'rgba(168,85,247,0.25)',
      tag: 'solo mode',
      onClick: () => setShowSoloModal(true),
    },
    {
      icon: '👥',
      label: 'MY TEAMS',
      sub: 'Manage your squads',
      accent: '#38bdf8',
      accentDim: 'rgba(56,189,248,0.08)',
      border: 'rgba(56,189,248,0.2)',
      hoverBorder: 'rgba(56,189,248,0.6)',
      glow: 'rgba(56,189,248,0.2)',
      tag: 'team mode',
      onClick: () => setShowTeamsList(true),
    },
    {
      icon: '🤝',
      label: 'JOIN TEAM',
      sub: 'Find a team to join',
      accent: '#34d399',
      accentDim: 'rgba(52,211,153,0.08)',
      border: 'rgba(52,211,153,0.2)',
      hoverBorder: 'rgba(52,211,153,0.6)',
      glow: 'rgba(52,211,153,0.2)',
      tag: 'join mode',
      onClick: () => setShowJoinTeams(true),
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: '#000', fontFamily: "'Syne', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

        @keyframes gp-fadein {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gp-scalein {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gp-glow-pulse {
          0%,100% { opacity: 0.1; transform: scale(1); }
          50%      { opacity: 0.2; transform: scale(1.06); }
        }
        @keyframes gp-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(400%); opacity: 0; }
        }

        .gp-card {
          position: relative;
          cursor: pointer;
          border-radius: 20px;
          padding: 2.5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
          transition: transform 0.4s cubic-bezier(.22,1,.36,1), box-shadow 0.4s ease, border-color 0.3s ease;
          overflow: hidden;
          border: 1px solid;
          animation: gp-fadein 0.6s cubic-bezier(.22,1,.36,1) both;
        }
        .gp-card:hover {
          transform: translateY(-6px) scale(1.02);
        }
        .gp-card::before {
          content: '';
          position: absolute;
          top: -60px; left: -40px;
          width: 200px; height: 200px;
          border-radius: 50%;
          filter: blur(60px);
          transition: opacity 0.4s ease;
          opacity: 0;
          pointer-events: none;
        }
        .gp-card:hover::before { opacity: 1; }

        .gp-scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          animation: gp-scan 3s ease-in-out infinite;
          pointer-events: none;
        }

        .gp-modal-overlay {
          animation: gp-fadein 0.2s ease;
        }
        .gp-modal-box {
          animation: gp-scalein 0.25s cubic-bezier(.22,1,.36,1);
        }

        .gp-select {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem;
          outline: none;
          transition: border-color 0.2s;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 2.5rem;
        }
        .gp-select:focus { border-color: rgba(168,85,247,0.6); }
        .gp-select option { background: #111; color: #fff; }

        .gp-label {
          font-family: 'Space Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          display: block;
          margin-bottom: 0.5rem;
        }
        .gp-label span { color: rgba(168,85,247,0.8); }

        .gp-pill-btn {
          padding: 0.4rem 0.9rem;
          border-radius: 9px;
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.5);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .gp-pill-btn:hover {
          border-color: rgba(168,85,247,0.4);
          color: #fff;
        }
        .gp-pill-btn.active {
          background: rgba(168,85,247,0.2);
          border-color: rgba(168,85,247,0.6);
          color: #fff;
          box-shadow: 0 0 12px rgba(168,85,247,0.2);
        }

        .gp-submit-btn {
          width: 100%;
          padding: 1rem;
          border-radius: 14px;
          font-family: 'Space Mono', monospace;
          font-size: 0.82rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
          background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899);
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          margin-top: 1rem;
        }
        .gp-submit-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(168,85,247,0.35);
        }
        .gp-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .gp-submit-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: -60%;
          width: 40%; height: 200%;
          background: rgba(255,255,255,0.1);
          transform: skewX(-20deg);
          transition: left 0.5s ease;
        }
        .gp-submit-btn:hover::after { left: 130%; }

        .noise-bg {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.025;
        }

        @media (max-width: 768px) {
          .gp-card { padding: 1.75rem 1.5rem; }
          .gp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="noise-bg absolute inset-0" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', animation: 'gp-glow-pulse 8s ease-in-out infinite' }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.07) 0%, transparent 70%)', animation: 'gp-glow-pulse 10s ease-in-out infinite 3s' }} />
      </div>

      {/* Page */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">

        {/* Header */}
        <div className="flex justify-between items-start mb-14 sm:mb-20" style={{ animation: 'gp-fadein 0.5s ease both' }}>
          <div>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(168,85,247,0.6)' }}>
              select your mode
            </span>
            <h1 className="text-4xl sm:text-6xl font-black mt-1 leading-none" style={{
              background: 'linear-gradient(135deg, #fff 0%, #e2d9f3 40%, #a855f7 80%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>
              GAME MODE
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.03]"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            ← Back
          </button>
        </div>

        {/* Mode Cards */}
        <div className="gp-grid grid md:grid-cols-3 gap-5 sm:gap-6 mb-12">
          {modes.map((m, i) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="gp-card text-left"
              style={{
                background: m.accentDim,
                borderColor: m.border,
                animationDelay: `${i * 0.1}s`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = m.hoverBorder;
                e.currentTarget.style.boxShadow = `0 20px 60px ${m.glow}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = m.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="gp-scan-line" />

              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-3xl opacity-20" style={{ background: `radial-gradient(circle at top right, ${m.accent}, transparent)` }} />

              {/* Tag */}
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: m.accent,
                opacity: 0.7,
                marginBottom: '0.25rem',
              }}>{m.tag}</span>

              {/* Icon */}
              <div className="text-5xl sm:text-6xl mb-2" style={{ filter: `drop-shadow(0 0 16px ${m.accent}55)` }}>
                {m.icon}
              </div>

              {/* Title */}
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif", color: '#fff' }}>
                {m.label}
              </h2>

              {/* Sub */}
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                {m.sub}
              </p>

              {/* Bottom arrow */}
              <div className="mt-4 flex items-center gap-1.5" style={{ color: m.accent, opacity: 0.7 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em' }}>ENTER</span>
                <span style={{ fontSize: '0.8rem' }}>→</span>
              </div>
            </button>
          ))}
        </div>

        {/* SOLO QUEUE MODAL */}
        {showSoloModal && (
          <div
            className="gp-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-5"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)' }}
            onClick={() => setShowSoloModal(false)}
          >
            <div
              className="gp-modal-box w-full max-w-md rounded-2xl p-7 sm:p-8 relative"
              style={{
                background: 'rgba(8,8,8,0.97)',
                border: '1px solid rgba(168,85,247,0.25)',
                boxShadow: '0 0 60px rgba(168,85,247,0.1)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-7">
                <div>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(168,85,247,0.6)' }}>
                    matchmaking
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    SOLO QUEUE
                  </h3>
                </div>
                <button
                  onClick={() => setShowSoloModal(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all hover:scale-110"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.9)' }}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5">
          <div>
              <label className="gp-label">
              <span>*</span> Games
              {/* Badge showing this is AI-generated */}
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.1rem 0.5rem',
                borderRadius: '6px',
                background: 'rgba(168,85,247,0.15)',
                border: '1px solid rgba(168,85,247,0.3)',
                color: 'rgba(168,85,247,0.8)',
                fontSize: '0.55rem',
                letterSpacing: '0.08em',
                verticalAlign: 'middle',
              }}>✦ What you wanna play now</span>
              
            </label>
            <div className="flex  gap-2">
             {['Discussion', 'Quizz', 'Truth and Dare', 'Pass the Story'].map(mode => (
               <button
                 key={mode}
                 onClick={() => setSoloQueueData({ ...soloQueueData, Games: mode })}
                 className={`gp-pill-btn ${soloQueueData.Games === mode ? 'active' : ''}`}
               >
                 {mode}
               </button>
             ))}
           </div>
         </div>
       {soloQueueData.Games !== 'Truth and Dare' && (
               
                <div>
                  <label className="gp-label">
                    <span>*</span> Topic
                    {/* Badge showing this is AI-generated */}
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(168,85,247,0.15)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      color: 'rgba(168,85,247,0.8)',
                      fontSize: '0.55rem',
                      letterSpacing: '0.08em',
                      verticalAlign: 'middle',
                    }}>✦ AI · TODAY</span>
                  </label>

                  <select
                    value={soloQueueData.topic}
                    onChange={(e) => setSoloQueueData({ ...soloQueueData, topic: e.target.value })}
                    className="gp-select"
                    disabled={topicsLoading}
                  >
                  
                   {soloQueueData.Games === 'Discussion' || soloQueueData.Games === 'Quizz' ? (
                       // AI trending topics
                     topicsLoading ? (
                       <option value="">⏳ Loading today's topics...</option>
                     ) : aiTopics.length === 0 ? (
                       <option value="">No topics available right now</option>
                     ) : (
                       <>
                         <option value="">Select a topic</option>
                         {aiTopics.map(t => (
                           <option key={t.category} value={t.category}>
                             {t.emoji ? `${t.emoji} ${t.category}` : t.category}
                           </option>
                         ))}
                       </>
                     )
                   ) : soloQueueData.Games === 'Pass the Story' ? (
                     <>
                       <option value="">Select a category</option>
                       {Genre.map(item => (
                         <option key={item} value={item}>{item}</option>
                       ))}
                     </>
                   ) 
                   : (
                     <option value="">Select a game mode first</option>
                   )} 
                  </select>

                  {/* Show the matched topic description as a hint */}
                  {soloQueueData.topic && (() => {
                    const matched = aiTopics.find(t => t.category === soloQueueData.topic);
                    return matched ? (
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.62rem', color: 'rgba(168,85,247,0.6)', marginTop: '0.4rem' }}>
                        → {matched.description}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
                {/* Player Count */}
                <div>
                  <label className="gp-label"><span>*</span> Team Size</label>
                  <select
                    value={soloQueueData.playerCount}
                    onChange={(e) => setSoloQueueData({ ...soloQueueData, playerCount: parseInt(e.target.value) })}
                    className="gp-select"
                  >
                    <option value={1}>1 Player (Solo)</option>
                    <option value={2}>2 Players (Find +1)</option>
                    <option value={3}>3 Players (Find +2)</option>
                    <option value={4}>4 Players (Find +3)</option>
                  </select>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem' }}>
                    {soloQueueData.playerCount === 1
                      ? '→ you will play alone'
                      : `→ system will find ${soloQueueData.playerCount - 1} random player(s)`}
                  </p>
                </div>

                {/* Opponent Type */}
                <div>
                  <label className="gp-label">Choose your Opponent</label>
                  <div className="flex flex-wrap gap-2">
                    {['solo', 'duo', 'trio', 'squad', 'default'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setSoloQueueData({ ...soloQueueData, opponentType: mode })}
                        className={`gp-pill-btn ${soloQueueData.opponentType === mode ? 'active' : ''}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Count */}
                <div>
                  <label className="gp-label">
  <span>*</span> {soloQueueData.Games === 'Discussion' || soloQueueData.Games === 'Quizz' ? 'Questions' : 'Chits'}
</label>
                  <select
                    value={soloQueueData.questionCount}
                    onChange={(e) => setSoloQueueData({ ...soloQueueData, questionCount: parseInt(e.target.value) })}
                    className="gp-select"
                  >
                   {[5, 10, 15, 20].map(n => (
  <option key={n} value={n}>
    {n} {soloQueueData.Games === 'Discussion' || soloQueueData.Games === 'Quizz' ? 'Questions' : 'Chits'}
  </option>
))}
                  </select>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

                {/* Submit */}
                <button
                  onClick={handleSoloQueue}
                  disabled={!socket || !user ||(soloQueueData.Games !== 'Truth and Dare' && !soloQueueData.topic)  || isQueuing || topicsLoading}
                  className="gp-submit-btn"
                >
                  {!user ? 'Loading...' : isQueuing ? '⏳ Searching...' : '⚡ Find Match'}
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