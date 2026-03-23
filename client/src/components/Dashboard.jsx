import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';

function DiscussionHistoryCard({ game }) {
  const [expanded, setExpanded] = useState(false);

  const renderStars = (avg) => {
    if (avg == null) return <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>no ratings</span>;
    return (
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(s => (
          <span key={s} style={{ color: s <= Math.round(avg) ? '#fbbf24' : 'rgba(255,255,255,0.12)', fontSize: '0.75rem' }}>★</span>
        ))}
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>{avg}/5</span>
      </div>
    );
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left transition-all"
        style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
            💬
          </div>
          <div>
            <div className="font-bold text-white" style={{ fontFamily: "'Syne', sans-serif", fontSize: '0.95rem' }}>{game.topic}</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
              {new Date(game.playedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{game.totalQuestions} questions
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {renderStars(game.overallAvg)}
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>Players</div>
              <div className="flex flex-wrap gap-2">
                {game.players?.map((p, i) => (
                  <span key={i} style={{
                    padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace",
                    background: p.team === 'teamA' ? 'rgba(139,92,246,0.12)' : 'rgba(251,191,36,0.1)',
                    border: `1px solid ${p.team === 'teamA' ? 'rgba(139,92,246,0.3)' : 'rgba(251,191,36,0.25)'}`,
                    color: p.team === 'teamA' ? 'rgba(196,181,253,0.9)' : 'rgba(251,191,36,0.8)',
                  }}>
                    {p.username}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>Questions Discussed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {game.questions?.map((q) => {
                  const qRating = game.ratingsReceived?.find(r => r.questionNumber === q.number);
                  return (
                    <div key={q.number} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.6rem 0.85rem' }}>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', color: 'rgba(168,85,247,0.5)', marginTop: '2px', flexShrink: 0 }}>Q{q.number}</span>
                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{q.text}</span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {qRating ? renderStars(qRating.avg) : <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>not rated</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
      const res = await axios.get(`${BACKEND_URL}/api/auth/me`, { withCredentials: true });
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
      const res = await axios.get(`${BACKEND_URL}/api/game/history`, { withCredentials: true });
      if (res.data.success) setGameHistory(res.data.games || []);
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  };

  const handleUpdateBio = async () => {
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/auth/update-bio`, { bio }, { withCredentials: true });
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
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono', monospace" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(168,85,247,0.3)', borderTopColor: '#a855f7', animation: 'db-spin 0.8s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Loading...</span>
        </div>
      </div>
    );
  }

  const avgRating = (() => {
    const withRatings = gameHistory.filter(g => g.overallAvg != null);
    return withRatings.length > 0
      ? (withRatings.reduce((s, g) => s + g.overallAvg, 0) / withRatings.length).toFixed(1)
      : '—';
  })();

  const totalQuestions = gameHistory.reduce((s, g) => s + (g.totalQuestions || 0), 0);

  const stats = [
    { icon: '💬', value: gameHistory.length, label: 'Discussions', accent: '#a855f7', dim: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)' },
    { icon: '⭐', value: avgRating, label: 'Avg Rating', accent: '#fbbf24', dim: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
    { icon: '❓', value: totalQuestions, label: 'Questions Discussed', accent: '#38bdf8', dim: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

        @keyframes db-fadein {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes db-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes db-glow-pulse {
          0%,100% { opacity: 0.1; transform: scale(1); }
          50%      { opacity: 0.18; transform: scale(1.05); }
        }
        @keyframes db-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes db-avatar-ring {
          0%,100% { box-shadow: 0 0 0 3px rgba(168,85,247,0.25), 0 0 30px rgba(168,85,247,0.1); }
          50%      { box-shadow: 0 0 0 4px rgba(168,85,247,0.45), 0 0 50px rgba(168,85,247,0.2); }
        }

        .db-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .db-card:hover {
          border-color: rgba(168,85,247,0.3);
        }
        .db-stat-card {
          border-radius: 16px;
          padding: 1.5rem;
          transition: transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s ease;
        }
        .db-stat-card:hover {
          transform: translateY(-4px);
        }
        .db-mono {
          font-family: 'Space Mono', monospace;
        }
        .db-tag {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .db-input {
          width: 100%;
          padding: 0.65rem 0.9rem;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 0.78rem;
          outline: none;
          resize: none;
          transition: border-color 0.2s;
        }
        .db-input:focus { border-color: rgba(168,85,247,0.5); }
        .db-section-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 30%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
        }
        .db-grid-noise {
          background-image:
            linear-gradient(rgba(139,92,246,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .db-nav-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          font-family: 'Space Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .db-nav-btn:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.07);
        }
        .db-logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          font-family: 'Space Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: rgba(239,68,68,0.8);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .db-logout-btn:hover {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.5);
          color: #f87171;
        }
        .db-topic-pill {
          padding: 3px 12px;
          border-radius: 999px;
          font-family: 'Space Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.06em;
          background: rgba(168,85,247,0.1);
          border: 1px solid rgba(168,85,247,0.25);
          color: rgba(196,181,253,0.85);
          transition: all 0.2s;
        }
        .db-topic-pill:hover {
          background: rgba(168,85,247,0.2);
          border-color: rgba(168,85,247,0.5);
        }
        @media (max-width: 1024px) {
          .db-layout { grid-template-columns: 1fr !important; }
          .db-sidebar { order: -1; }
        }
        @media (max-width: 640px) {
          .db-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div className="db-grid-noise" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', animation: 'db-glow-pulse 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.07) 0%, transparent 70%)', animation: 'db-glow-pulse 7s ease-in-out infinite 2s' }} />
      </div>

      {/* Page */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', animation: 'db-fadein 0.4s ease both' }}>
          <div>
            <div className="db-tag" style={{ color: 'rgba(168,85,247,0.6)', marginBottom: '4px' }}>your space</div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 0%, #e2d9f3 40%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              DASHBOARD
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={() => navigate('/')} className="db-nav-btn">← Home</button>
            <button onClick={handleLogout} className="db-logout-btn">Logout</button>
          </div>
        </div>

        {/* Main layout */}
        <div className="db-layout" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── SIDEBAR ── */}
          <div className="db-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'db-fadein 0.5s ease 0.1s both' }}>

            {/* Profile card */}
            <div className="db-card" style={{ padding: '1.75rem 1.5rem' }}>

              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', animation: 'db-avatar-ring 3s ease-in-out infinite' }}>
                  {user?.profilePic || '👤'}
                </div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 800, marginTop: '0.75rem', marginBottom: '2px', background: 'linear-gradient(135deg, #fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {user?.username}
                </h2>
                <span className="db-tag" style={{ color: 'rgba(255,255,255,0.25)' }}>ID: {user?._id?.slice(-8).toUpperCase()}</span>
              </div>

              {/* Level + XP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Level', value: user?.level || 1, color: '#a855f7' },
                  { label: 'XP', value: user?.xp || 0, color: '#ec4899' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                    <div className="db-tag" style={{ color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.75rem 0' }} />

              {/* Bio */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span className="db-tag" style={{ color: 'rgba(255,255,255,0.3)' }}>Bio</span>
                  <button
                    onClick={() => setEditingBio(!editingBio)}
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'rgba(168,85,247,0.7)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}
                  >
                    {editingBio ? 'cancel' : 'edit →'}
                  </button>
                </div>
                {editingBio ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      placeholder="Write about yourself..."
                      className="db-input"
                      rows={4}
                    />
                    <button
                      onClick={handleUpdateBio}
                      style={{ padding: '0.6rem', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Save Bio
                    </button>
                  </div>
                ) : (
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                    {user?.bio || 'No bio yet. Click edit to add one!'}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.75rem 0' }} />

              {/* Class */}
              <div style={{ marginBottom: '1rem' }}>
                <span className="db-tag" style={{ color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: '0.4rem' }}>Class</span>
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 700 }}>Class {user?.class || 'N/A'}</span>
              </div>

              {/* Topics */}
              <div>
                <span className="db-tag" style={{ color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: '0.5rem' }}>Topics</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {user?.topics?.map((topic, i) => (
                    <span key={i} className="db-topic-pill">{topic}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'db-fadein 0.5s ease 0.2s both' }}>

            {/* Stats */}
            <div>
              <div className="db-section-title">STATS</div>
              <div className="db-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className="db-stat-card"
                    style={{ background: s.dim, border: `1px solid ${s.border}`, animationDelay: `${0.1 * i}s` }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 16px 40px ${s.dim}`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem', filter: `drop-shadow(0 0 10px ${s.accent}55)` }}>{s.icon}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 800, color: s.accent, lineHeight: 1 }}>{s.value}</div>
                    <div className="db-tag" style={{ color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Friends */}
            <div>
              <div className="db-section-title">FRIENDS</div>
              <div className="db-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem', filter: 'grayscale(0.5)' }}>👥</div>
                <p className="db-tag" style={{ color: 'rgba(255,255,255,0.25)' }}>Friends feature coming soon...</p>
              </div>
            </div>

            {/* Discussion History */}
            <div>
              <div className="db-section-title">DISCUSSION HISTORY</div>
              <div className="db-card" style={{ padding: '1.25rem' }}>
                {gameHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💬</div>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>No discussions yet!</p>
                    <p className="db-tag" style={{ color: 'rgba(255,255,255,0.3)' }}>Join a discussion room to get started</p>
                    <button
                      onClick={() => navigate('/game')}
                      style={{ marginTop: '1.5rem', padding: '0.7rem 2rem', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(168,85,247,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      Start Discussing →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {gameHistory.slice(0, 10).map((game, index) => (
                      <DiscussionHistoryCard key={game._id || index} game={game} />
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