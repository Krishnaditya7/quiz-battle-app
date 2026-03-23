import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Lenis from '@studio-freight/lenis';
import { BACKEND_URL } from '../config';

export default function HomePage({ user: propUser }) {
  useEffect(() => {
    console.log('propUser received:', propUser);
  }, [propUser]);

  const [currentUser, setCurrentUser] = useState(propUser ?? null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 0.8,
      smoothWheel: true,
      smoothTouch: false,
      lerp: 0.1,
    });
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(new Set());
  const [topUsers, setTopUsers] = useState([]);
  const [editingBio, setEditingBio] = useState(null);
  const [newBio, setNewBio] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [titleHovered, setTitleHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stepsRef = useRef([]);
  const heroRef = useRef(null);

  useEffect(() => {
    setCurrentUser(propUser || null);
  }, [propUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchUnreadCount = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/notification/unread-count`,
          { withCredentials: true }
        );
        if (res.data.success) setUnreadCount(res.data.unreadCount);
      } catch (err) {
        console.log('Unread count error:', err);
      }
    };
    fetchUnreadCount();
  }, [currentUser]);

  useEffect(() => {
    fetchTop3();
    const handleScroll = () => {
      const el = document.documentElement;
      const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.stepIndex);
            setVisibleSteps(prev => new Set([...prev, idx]));
          }
        });
      },
      { threshold: 0.25 }
    );
    stepsRef.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const fetchTop3 = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/leaderboard/top3`);
      if (res.data.success) setTopUsers(res.data.top3);
    } catch (err) {
      console.error('Failed to fetch top 3:', err);
      setTopUsers([{ username: 'Loading...', level: 0, bio: '', stats: { wins: 0 } }]);
    }
  };

  const handleUpdateBio = async (userId) => {
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/api/leaderboard/bio`,
        { bio: newBio },
        { withCredentials: true }
      );
      if (res.data.success) {
        alert('Bio updated!');
        fetchTop3();
        setEditingBio(null);
        setNewBio('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update bio');
    }
  };

  const isMyProfile = (topUser) => {
    if (!currentUser) return false;
    return String(currentUser._id) === String(topUser._id);
  };

  const steps = [
    {
      title: "01. Sign Up",
      desc: "Create your account in seconds. Choose your favorite subjects and start your journey.",
      icon: "🎯"
    },
    {
      title: "02. Join or Create Team",
      desc: "Solo warrior or team player? Your choice. Build your squad or go alone.",
      icon: "👥"
    },
    {
      title: "03. Choose Game Mode",
      desc: "Vibe check with people and discuss on topics you love to SKIBE",
      icon: "🎮"
    },
    {
      title: "04. Match & Play",
      desc: "AI finds your perfect opponent. Real-time battles. Epic victories.",
      icon: "⚡"
    }
  ];

  const particles = useRef(
    [...Array(28)].map(() => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      duration: 6 + Math.random() * 10,
      size: Math.random() > 0.7 ? 2 : 1,
      color: Math.random() > 0.5 ? 'rgba(139,92,246,0.4)' : 'rgba(236,72,153,0.3)',
    }))
  );

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: "'Syne', sans-serif" }}>

      {/* Google Font Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

        .title-hover {
          display: inline-block;
          transition: transform 0.5s cubic-bezier(.22,1,.36,1);
          cursor: default;
        }
        .title-hover:hover {
          transform: rotate(-6deg) scale(1.04);
        }

        @keyframes float-particle {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          33% { transform: translateY(-18px) translateX(8px); opacity: 0.7; }
          66% { transform: translateY(10px) translateX(-6px); opacity: 0.5; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50% { opacity: 0.22; transform: scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ping-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes noise-flicker {
          0%,100% { opacity: 0.03; }
          50% { opacity: 0.06; }
        }
        @keyframes text-glitch {
          0%, 95%, 100% { clip-path: inset(0 0 100% 0); }
          96% { clip-path: inset(10% 0 60% 0); transform: skewX(-4deg); }
          97% { clip-path: inset(50% 0 20% 0); transform: skewX(4deg); }
          98% { clip-path: inset(0 0 100% 0); }
        }
        @keyframes badge-pop {
          0% { transform: scale(0.7) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .noise-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          animation: noise-flicker 4s ease-in-out infinite;
        }
        .card-glow:hover {
          box-shadow: 0 0 40px rgba(139,92,246,0.18), 0 0 80px rgba(236,72,153,0.08);
        }
        .btn-shine {
          position: relative;
          overflow: hidden;
        }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: -50%; left: -60%;
          width: 40%; height: 200%;
          background: rgba(255,255,255,0.12);
          transform: skewX(-20deg);
          transition: left 0.5s ease;
        }
        .btn-shine:hover::after { left: 130%; }
        .nav-link {
          position: relative;
          font-family: 'Space Mono', monospace;
          font-size: 0.78rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -3px; left: 0;
          width: 0; height: 1px;
          background: linear-gradient(90deg, #a855f7, #ec4899);
          transition: width 0.3s ease;
        }
        .nav-link:hover::after { width: 100%; }
        .step-line::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 0; bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, rgba(139,92,246,0.5), transparent);
        }
        .tag-pill {
          font-family: 'Space Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .hero-title { font-size: clamp(2.8rem, 12vw, 6rem) !important; }
          .step-row { flex-direction: column !important; }
          .step-row-reverse { flex-direction: column !important; }
        }
      `}</style>

      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-white/5 z-50">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${scrollProgress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)',
            boxShadow: '0 0 10px rgba(168,85,247,0.7)',
          }}
        />
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-40 border-b border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <button
              onClick={() => navigate('/')}
              className="relative group"
            >
              <span className="text-xl sm:text-2xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fff 30%, #a855f7 70%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SKIBES
              </span>
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-gradient-to-r from-purple-500 to-pink-500 group-hover:w-full transition-all duration-500" />
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex gap-7 items-center">
              {!currentUser && (
                <button onClick={() => navigate('/auth')} className="nav-link text-white/70 hover:text-white transition-colors duration-200">
                  Sign Up
                </button>
              )}
              <button onClick={() => navigate('/game')} className="nav-link text-white/70 hover:text-white transition-colors duration-200">
                Games
              </button>
              <button onClick={() => navigate('/notifications')} className="nav-link relative text-white/70 hover:text-white transition-colors duration-200">
                Notifs
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-3 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button className="nav-link text-white/70 hover:text-white transition-colors duration-200">
                Leaderboard
              </button>
              {currentUser ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm hover:scale-105 transition-all duration-300 border border-purple-500/40 hover:border-purple-400"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
                  title={`Logged in as ${currentUser.username}`}
                >
                  👤
                </button>
              ) : null}
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden flex flex-col gap-[5px] p-2" onClick={() => setMobileMenuOpen(v => !v)}>
              <span className={`block w-5 h-[1.5px] bg-white transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/10 flex flex-col gap-4 pt-4">
              {!currentUser && (
                <button onClick={() => { navigate('/auth'); setMobileMenuOpen(false); }} className="nav-link text-white/70 hover:text-white text-left">Sign Up</button>
              )}
              <button onClick={() => { navigate('/game'); setMobileMenuOpen(false); }} className="nav-link text-white/70 hover:text-white text-left">Games</button>
              <button onClick={() => { navigate('/notifications'); setMobileMenuOpen(false); }} className="nav-link text-white/70 hover:text-white text-left relative w-fit">
                Notifs
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-3 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <button className="nav-link text-white/70 hover:text-white text-left">Leaderboard</button>
              {currentUser && (
                <button onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }} className="nav-link text-white/70 hover:text-white text-left">Dashboard</button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section ref={heroRef} className="min-h-screen flex items-center justify-center relative pt-20 overflow-hidden">

        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[15%] left-[8%] w-64 sm:w-96 h-64 sm:h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', animation: 'glow-pulse 7s ease-in-out infinite' }} />
          <div className="absolute bottom-[10%] right-[5%] w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', animation: 'glow-pulse 9s ease-in-out infinite 2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', animation: 'glow-pulse 5s ease-in-out infinite 1s' }} />
        </div>

        {/* Noise texture */}
        <div className="noise-overlay absolute inset-0 pointer-events-none opacity-[0.04]" />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.current.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                top: p.top + '%', left: p.left + '%',
                width: p.size + 'px', height: p.size + 'px',
                background: p.color,
                animation: `float-particle ${p.duration}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 text-center px-5 sm:px-8 max-w-5xl mx-auto w-full">

          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 mb-8 text-purple-300/80" style={{ background: 'rgba(124,58,237,0.08)', animation: 'fade-up 0.8s ease forwards' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="tag-pill">AI-powered multiplayer platform</span>
          </div>

          {/* Main Title */}
          <h1
            className="hero-title title-hover font-black leading-[0.9] mb-8 select-none"
            style={{
              fontSize: 'clamp(3rem, 10vw, 7.5rem)',
              fontFamily: "'Syne', sans-serif",
              background: 'linear-gradient(135deg, #ffffff 0%, #e2d9f3 30%, #a855f7 60%, #ec4899 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'fade-up 0.9s ease forwards, shimmer 4s linear infinite',
              letterSpacing: '-0.02em',
            }}
          >
            VIBIN' AND<br />DISCUSSIN'
          </h1>

          <p className="text-base sm:text-xl text-white/50 mb-4 font-light max-w-xl mx-auto leading-relaxed" style={{ animation: 'fade-up 1s ease forwards', fontFamily: "'Space Mono', monospace", letterSpacing: '0.02em' }}>
            Vibe check with people and discuss on topics you love to SKIBE
          </p>
          <p className="text-sm text-purple-400/70 mb-12" style={{ fontFamily: "'Space Mono', monospace", animation: 'fade-up 1.1s ease forwards' }}>
            — powered by <span className="text-purple-300">AI</span> · next-gen platform
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center flex-wrap" style={{ animation: 'fade-up 1.2s ease forwards' }}>
            <button
              onClick={() => navigate('/auth')}
              className="btn-shine px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold text-sm sm:text-base tracking-widest uppercase hover:scale-[1.04] transition-all duration-300 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)',
                boxShadow: '0 0 30px rgba(168,85,247,0.25)',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              Start Skibing →
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold text-sm sm:text-base tracking-widest uppercase hover:scale-[1.04] transition-all duration-300 border border-white/15 hover:border-purple-500/50 hover:bg-purple-500/10"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Watch Demo
            </button>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center p-1.5">
              <div className="w-0.5 h-2 bg-purple-400 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="min-h-screen py-28 sm:py-36 relative">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">

          <div className="flex flex-col items-center mb-20 sm:mb-28">
            <span className="tag-pill text-purple-400/60 mb-4">the process</span>
            <h2 className="text-4xl sm:text-6xl font-black text-center" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HOW IT WORKS
            </h2>
            <div className="mt-4 w-20 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
          </div>

          <div className="absolute left-1/2 top-48 bottom-0 w-[1px] bg-gradient-to-b from-purple-500/30 to-transparent -translate-x-1/2 hidden md:block" />

          {steps.map((step, index) => (
            <div
              key={index}
              ref={el => stepsRef.current[index] = el}
              data-step-index={index}
              className="mb-20 sm:mb-32"
            >
              <div
                className={`flex items-center gap-8 sm:gap-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'} transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${
                  visibleSteps.has(index)
                    ? 'opacity-100 translate-x-0'
                    : `opacity-0 ${index % 2 === 0 ? '-translate-x-20' : 'translate-x-20'}`
                }`}
                style={{ flexDirection: window.innerWidth < 768 ? 'column' : undefined }}
              >
                {/* Icon */}
                <div className={`relative flex-shrink-0 transition-all duration-700 ${visibleSteps.has(index) ? 'scale-110' : 'scale-100'}`}>
                  <div
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(236,72,153,0.15))',
                      border: '1px solid rgba(139,92,246,0.3)',
                      boxShadow: visibleSteps.has(index) ? '0 0 40px rgba(139,92,246,0.2)' : 'none',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {step.icon}
                  </div>
                  {visibleSteps.has(index) && (
                    <div className="absolute inset-0 rounded-2xl border border-purple-500/50" style={{ animation: 'ping-ring 1.5s ease-out forwards' }} />
                  )}
                </div>

                {/* Content */}
                <div
                  className="flex-1 rounded-2xl p-6 sm:p-8 card-glow transition-all duration-700"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${visibleSteps.has(index) ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <span className="tag-pill text-purple-400/50 block mb-2">{step.title.split('.')[0]}.</span>
                  <h3 className="text-2xl sm:text-4xl font-black mb-3 text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {step.title.split('. ')[1]}
                  </h3>
                  <p className="text-base sm:text-lg text-white/50 leading-relaxed" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.85rem' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOP PLAYERS */}
      <section className="min-h-screen py-28 sm:py-36 relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          <div className="flex flex-col items-center mb-16 sm:mb-24">
            <span className="tag-pill text-yellow-400/60 mb-4">hall of fame</span>
            <h2 className="text-4xl sm:text-6xl font-black text-center" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fbbf24, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HALL OF LEGENDS
            </h2>
            <div className="mt-4 w-20 h-[1px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
            <p className="text-white/40 mt-4 text-center" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.8rem' }}>
              meet the warriors who conquered the battlefield
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {topUsers.map((topUser, index) => (
              <div
                key={topUsers._id || index}
                className="group relative"
                style={{ animation: `fade-up 0.6s ease forwards ${index * 0.15}s`, opacity: 0 }}
              >
                {index === 0 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ animation: 'badge-pop 0.6s ease forwards 0.3s', opacity: 0 }}>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black"
                      style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', boxShadow: '0 0 20px rgba(251,191,36,0.4)' }}
                    >
                      👑
                    </div>
                  </div>
                )}

                <div
                  className={`relative h-full rounded-2xl p-6 sm:p-8 card-glow transition-all duration-500 hover:scale-[1.03]`}
                  style={{
                    background: index === 0
                      ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(249,115,22,0.06))'
                      : index === 1
                      ? 'linear-gradient(135deg, rgba(148,163,184,0.06), rgba(100,116,139,0.06))'
                      : 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(239,68,68,0.06))',
                    border: `1px solid ${index === 0 ? 'rgba(251,191,36,0.2)' : index === 1 ? 'rgba(148,163,184,0.2)' : 'rgba(249,115,22,0.2)'}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {isMyProfile(topUser) && (
                    <button
                      onClick={() => { setEditingBio(topUser._id); setNewBio(topUser.bio || ''); }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm hover:scale-110 transition-all border border-purple-500/30 hover:border-purple-400"
                      style={{ background: 'rgba(124,58,237,0.3)' }}
                    >
                      ✏️
                    </button>
                  )}

                  <div className="absolute top-4 left-4 font-black text-5xl sm:text-6xl" style={{ fontFamily: "'Syne', sans-serif", color: index === 0 ? 'rgba(251,191,36,0.1)' : index === 1 ? 'rgba(148,163,184,0.1)' : 'rgba(249,115,22,0.1)' }}>
                    #{index + 1}
                  </div>

                  <div className="text-6xl mb-4 text-center mt-6">{topUser.profilePic || '👤'}</div>
                  <h3 className="text-2xl sm:text-3xl font-black mb-2 text-center" style={{ fontFamily: "'Syne', sans-serif" }}>{topUser.username}</h3>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="tag-pill px-2 py-1 rounded-md text-purple-300/80" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      LVL {topUser.level}
                    </span>
                    <span className="tag-pill px-2 py-1 rounded-md text-yellow-300/80" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      {topUser.stats?.wins || 0} WINS
                    </span>
                  </div>

                  {editingBio === topUser._id ? (
                    <div className="space-y-3">
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        maxLength={500}
                        placeholder="Write your story..."
                        className="w-full px-4 py-3 rounded-xl text-white resize-none text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.4)', outline: 'none', fontFamily: "'Space Mono', monospace" }}
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateBio(topUser._id)}
                          className="flex-1 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                          style={{ background: 'rgba(22,163,74,0.3)', border: '1px solid rgba(22,163,74,0.4)', fontFamily: "'Space Mono', monospace" }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBio(null)}
                          className="flex-1 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Space Mono', monospace" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm text-center leading-relaxed" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {topUser.bio || 'No story yet...'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] py-16" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10 sm:gap-12 mb-12">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black mb-4" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fff, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SKIBES
              </h3>
              <p className="text-white/35 leading-relaxed text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>
                The future of competitive learning. Built by students, for students.
              </p>
            </div>

            <div>
              <h4 className="tag-pill text-purple-300/70 mb-5 block">Contact</h4>
              <div className="space-y-3 text-white/40 text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>
                <p>📧 support@skibes.com</p>
                <p>💬 Discord: SKIBES#2024</p>
                <p>🐛 Report Bugs</p>
              </div>
            </div>

            <div>
              <h4 className="tag-pill text-purple-300/70 mb-5 block">Follow Us</h4>
              <div className="flex gap-3">
                {['𝕏', '📷', '💼', '🎮'].map((icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all hover:scale-110 hover:border-purple-500/50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white/25 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>BUILT BY INDIE DEV ~ KRISHNADITYA</p>
            <div className="flex gap-1">
              {['#vibes', '#discuss', '#skibe'].map(tag => (
                <span key={tag} className="tag-pill px-2 py-1 rounded text-purple-400/40" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* DEMO MODAL */}
      {showDemo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          onClick={() => setShowDemo(false)}
        >
          <div
            className="rounded-2xl p-8 sm:p-12 max-w-4xl w-full relative"
            style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(139,92,246,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDemo(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110 border border-white/10 hover:border-white/30"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              ✕
            </button>

            <h3 className="text-3xl sm:text-5xl font-black mb-8" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #fff, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HOW TO PLAY
            </h3>

            <div className="aspect-video rounded-2xl flex items-center justify-center mb-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-center">
                <div className="text-5xl mb-3">🎬</div>
                <p className="text-white/30 text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>Demo video placeholder</p>
              </div>
            </div>

            <p className="text-white/50 text-base leading-relaxed" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.85rem' }}>
              Watch how top players dominate the battlefield!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}