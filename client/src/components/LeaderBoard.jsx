import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function LeaderBoard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('global');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeaderboard = useCallback(async (type) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/leaderboard/all?type=${type}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setLeaderboard(res.data.leaderboard);
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setError('Failed to load leaderboard. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activeType);
  }, [activeType, fetchLeaderboard]);

  const filtered = leaderboard.filter(u =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = ['global', 'weekly', 'monthly'];

  const rankMeta = (rank) => {
    if (rank === 1) return { color: '#fbbf24', label: '👑', glow: 'rgba(251,191,36,0.35)' };
    if (rank === 2) return { color: '#94a3b8', label: '🥈', glow: 'rgba(148,163,184,0.25)' };
    if (rank === 3) return { color: '#f97316', label: '🥉', glow: 'rgba(249,115,22,0.25)' };
    return { color: 'rgba(255,255,255,0.25)', label: null, glow: null };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

        @keyframes lb-fadein {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lb-row-in {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lb-glow-pulse {
          0%,100% { opacity: 0.1; transform: scale(1); }
          50%      { opacity: 0.2; transform: scale(1.06); }
        }
        @keyframes lb-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lb-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes lb-shine {
          0%   { left: -60%; }
          100% { left: 130%; }
        }

        .lb-mono { font-family: 'Space Mono', monospace; }
        .lb-tag {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .lb-noise {
          background-image:
            linear-gradient(rgba(139,92,246,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .lb-tab {
          font-family: 'Space Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.45rem 1.1rem;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lb-tab:hover { color: #fff; border-color: rgba(255,255,255,0.2); }
        .lb-tab.active {
          background: rgba(168,85,247,0.18);
          border-color: rgba(168,85,247,0.5);
          color: #fff;
          box-shadow: 0 0 16px rgba(168,85,247,0.2);
        }
        .lb-search {
          width: 100%;
          padding: 0.65rem 1rem 0.65rem 2.6rem;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 0.78rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .lb-search:focus { border-color: rgba(168,85,247,0.45); }
        .lb-search::placeholder { color: rgba(255,255,255,0.2); }

        .lb-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.9rem 1.1rem;
          border-radius: 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.2s ease;
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .lb-row:hover {
          background: rgba(168,85,247,0.05);
          border-color: rgba(168,85,247,0.2);
          transform: translateX(4px);
        }
        .lb-row.top3 { border-color: rgba(255,255,255,0.1); }

        .lb-row-shine::after {
          content: '';
          position: absolute;
          top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: skewX(-15deg);
          transition: none;
        }
        .lb-row:hover .lb-row-shine::after,
        .lb-row-shine:hover::after { animation: lb-shine 0.6s ease forwards; }

        .lb-nav-btn {
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
        .lb-nav-btn:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.07);
        }

        .lb-podium-card {
          border-radius: 20px;
          padding: 1.5rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          transition: transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s ease;
          position: relative;
          overflow: hidden;
          border: 1px solid;
        }
        .lb-podium-card:hover { transform: translateY(-6px); }

        .lb-xp-bar-track {
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          overflow: hidden;
          flex: 1;
        }
        .lb-xp-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #7c3aed, #a855f7);
          transition: width 1s ease;
        }

        @media (max-width: 640px) {
          .lb-podium { grid-template-columns: 1fr !important; }
          .lb-cols-header { display: none !important; }
        }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div className="lb-noise" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', animation: 'lb-glow-pulse 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)', animation: 'lb-glow-pulse 7s ease-in-out infinite 3s' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '2rem 1.25rem 5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', animation: 'lb-fadein 0.4s ease both' }}>
          <div>
            <span className="lb-tag" style={{ color: 'rgba(251,191,36,0.6)', display: 'block', marginBottom: '4px' }}>hall of fame</span>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 0%, #fde68a 40%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, lineHeight: 1 }}>
              LEADERBOARD
            </h1>
          </div>
          <button onClick={() => navigate('/')} className="lb-nav-btn">← Home</button>
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '2rem', animation: 'lb-fadein 0.5s ease 0.1s both' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {tabs.map(t => (
              <button
                key={t}
                className={`lb-tab ${activeType === t ? 'active' : ''}`}
                onClick={() => setActiveType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search player..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="lb-search"
            />
          </div>
          <button
            onClick={() => fetchLeaderboard(activeType)}
            style={{ padding: '0.55rem 1rem', borderRadius: '10px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: 'rgba(168,85,247,0.9)', fontFamily: "'Space Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.12)'; }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '5rem 0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', animation: 'lb-spin 0.8s linear infinite' }} />
            <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.25)' }}>fetching legends...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <p className="lb-mono" style={{ color: 'rgba(239,68,68,0.8)', fontSize: '0.82rem' }}>{error}</p>
            <button
              onClick={() => fetchLeaderboard(activeType)}
              style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* TOP 3 PODIUM */}
            {!searchQuery && filtered.length >= 3 && (
              <div style={{ marginBottom: '2.5rem', animation: 'lb-fadein 0.5s ease 0.15s both' }}>
                <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.2)', display: 'block', marginBottom: '1rem' }}>top 3</span>
                <div className="lb-podium" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {filtered.slice(0, 3).map((u, i) => {
                    const meta = rankMeta(u.rank);
                    const podiumColors = [
                      { bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.25)', glow: 'rgba(251,191,36,0.15)' },
                      { bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.2)', glow: 'rgba(148,163,184,0.1)' },
                      { bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', glow: 'rgba(249,115,22,0.1)' },
                    ];
                    const pc = podiumColors[i];
                    return (
                      <div
                        key={u._id || i}
                        className="lb-podium-card"
                        style={{ background: pc.bg, borderColor: pc.border, animationDelay: `${0.1 * i}s`, animation: 'lb-fadein 0.5s ease both' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 20px 50px ${pc.glow}`; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {/* Crown / medal */}
                        <div style={{ fontSize: '1.5rem' }}>{meta.label}</div>

                        {/* Avatar */}
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: `2px solid ${meta.color}55` }}>
                          {u.profilePic || '👤'}
                        </div>

                        {/* Username */}
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '0.95rem', textAlign: 'center', marginTop: '2px' }}>{u.username}</span>

                        {/* Level badge */}
                        <span className="lb-tag" style={{ padding: '2px 10px', borderRadius: '999px', background: `${meta.color}18`, border: `1px solid ${meta.color}40`, color: meta.color }}>
                          LVL {u.level}
                        </span>

                        {/* XP */}
                        <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.3)' }}>{u.xp?.toLocaleString()} XP</span>

                        {/* Rank number watermark */}
                        <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontFamily: "'Syne', sans-serif", fontSize: '3rem', fontWeight: 800, color: `${meta.color}12`, lineHeight: 1 }}>
                          #{u.rank}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FULL TABLE */}
            <div style={{ animation: 'lb-fadein 0.5s ease 0.2s both' }}>
              {/* Column headers */}
              <div className="lb-cols-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1.1rem', marginBottom: '0.5rem' }}>
                <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.2)', width: '40px', flexShrink: 0 }}>Rank</span>
                <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.2)', flex: 1 }}>Player</span>
                <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.2)', width: '80px', textAlign: 'center' }}>Level</span>
                <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.2)', width: '100px', textAlign: 'right' }}>XP</span>
              </div>

              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <p className="lb-tag" style={{ color: 'rgba(255,255,255,0.25)' }}>No players found for "{searchQuery}"</p>
                  </div>
                )}
                {filtered.map((u, i) => {
                  const meta = rankMeta(u.rank);
                  const isTop3 = u.rank <= 3;
                  const xpMax = leaderboard[0]?.xp || 1;
                  return (
                    <div
                      key={u._id || i}
                      className={`lb-row ${isTop3 ? 'top3' : ''}`}
                      style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s`, animation: 'lb-row-in 0.4s ease both' }}
                    >
                      {/* Shine overlay */}
                      <div className="lb-row-shine" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

                      {/* Rank */}
                      <div style={{ width: '40px', flexShrink: 0, textAlign: 'center' }}>
                        {isTop3 ? (
                          <span style={{ fontSize: '1.1rem' }}>{meta.label}</span>
                        ) : (
                          <span className="lb-mono" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>#{u.rank}</span>
                        )}
                      </div>

                      {/* Avatar + Name + XP bar */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed55, #ec489955)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, border: isTop3 ? `1px solid ${meta.color}44` : '1px solid rgba(255,255,255,0.08)' }}>
                          {u.profilePic || '👤'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.92rem', color: isTop3 ? meta.color : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.username}
                          </div>
                          {/* XP bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                            <div className="lb-xp-bar-track">
                              <div className="lb-xp-bar-fill" style={{ width: `${Math.min((u.xp / xpMax) * 100, 100)}%`, background: isTop3 ? `linear-gradient(90deg, ${meta.color}99, ${meta.color})` : 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Level */}
                      <div style={{ width: '80px', textAlign: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', background: isTop3 ? `${meta.color}15` : 'rgba(168,85,247,0.1)', border: `1px solid ${isTop3 ? meta.color + '30' : 'rgba(168,85,247,0.2)'}`, color: isTop3 ? meta.color : 'rgba(196,181,253,0.8)' }}>
                          {u.level}
                        </span>
                      </div>

                      {/* XP value */}
                      <div style={{ width: '100px', textAlign: 'right', flexShrink: 0 }}>
                        <span className="lb-mono" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                          {u.xp?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer count */}
              {filtered.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                  <span className="lb-tag" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    showing {filtered.length} of {leaderboard.length} players
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}