import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Lenis from '@studio-freight/lenis';

export default function HomePage() {

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
  const [currentUser, setCurrentUser] = useState(null);

  const stepsRef = useRef([]);
  const heroRef = useRef(null);

  // Fetch data + scroll progress + step reveal observer
  useEffect(() => {
    fetchCurrentUser();
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

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        withCredentials: true
      });
      if (res.data.success) {
        setCurrentUser(res.data.user);
      }
    } catch (err) {
      console.log('Not logged in');
      setCurrentUser(null);
    }
  };

  const fetchTop3 = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/leaderboard/top3');
      if (res.data.success) {
        setTopUsers(res.data.top3);
      }
    } catch (err) {
      console.error('Failed to fetch top 3:', err);
      setTopUsers([
        { username: 'Loading...', level: 0, bio: '', stats: { wins: 0 } }
      ]);
    }
  };

  const handleUpdateBio = async (userId) => {
    try {
      const res = await axios.patch(
        'http://localhost:5000/api/leaderboard/bio',
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

  // ✅ FIXED - Now synchronous
  const isMyProfile = (topUser) => {
    return currentUser && currentUser._id === topUser._id;
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
      desc: "Quiz for competition, Debate for arguments, Discussion for chilling.",
      icon: "🎮"
    },
    {
      title: "04. Match & Play",
      desc: "AI finds your perfect opponent. Real-time battles. Epic victories.",
      icon: "⚡"
    }
  ];
const particles = useRef(
  [...Array(20)].map(() => ({
    top: Math.random() * 100,
    left: Math.random() * 100,
    duration: 6 + Math.random() * 10
  }))
)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-slate-800 z-50">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-xl bg-slate-950/80 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent cursor-pointer"
            >
              ShastrAi
            </button>
            <div className="flex gap-8 items-center">
              <button 
                onClick={() => navigate('/auth')}
                className="hover:text-purple-400 hover:scale-[1.05] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] font-semibold"
              >
                Sign Up
              </button>
              <button 
                onClick={() => navigate('/game')}
                className="hover:text-purple-400 hover:scale-[1.05] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] font-semibold"
              >
                Games
              </button>
              <button className="hover:text-purple-400 hover:scale-[1.05] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] font-semibold">
                Notifications
              </button>
              <button className="hover:text-purple-400 hover:scale-[1.05] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] font-semibold">
                Leaderboard
              </button>
              
              {/* USER ICON */}
              {currentUser && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xl hover:scale-[1.05] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] transition-all shadow-lg hover:shadow-purple-500/50"
                  title={`Logged in as ${currentUser.username}`}
                >
                  👤
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        ref={heroRef}
        className="min-h-screen flex items-center justify-center relative pt-20"
      >
        <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl float-slow smooth-transform"/>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl float-medium smooth-transform"/>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl float-fast smooth-transform"/>

        <div className="absolute inset-0 pointer-events-none">
<div className="absolute inset-0 pointer-events-none">

{particles.current.map((p,i)=>(
<div
key={i}
className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
style={{
top:p.top+"%",
left:p.left+"%",
animation:`float ${p.duration}s ease-in-out infinite`
}}
/>
))}

</div>

</div>
        </div>
        
      
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <h1 
            className="text-7xl md:text-9xl font-black mb-6 leading-tight"
            style={{
              background: 'linear-gradient(135deg, #fff 0%, #a855f7 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            BATTLE OF<br />BRAINS
          </h1>
          <p className="text-2xl text-slate-300 mb-12 font-light max-w-2xl mx-auto">
            Quiz. Debate. Discuss. Dominate.<br />
            <span className="text-purple-400 font-semibold">AI-powered multiplayer</span> platform for the next generation.
          </p>
          
          <div className="flex gap-6 justify-center flex-wrap">
            <button 
              onClick={() => navigate('/auth')}
              className="px-12 py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-lg hover:scale-[1.05] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/50"
            >
              START PLAYING
            </button>
            <button 
              onClick={() => setShowDemo(true)}
              className="px-12 py-5 border-2 border-purple-500 rounded-full font-bold text-lg hover:bg-purple-500/10 transition-all duration-300 hover:scale-[1.05] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
            >
              WATCH DEMO
            </button>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-purple-400 rounded-full flex items-start justify-center p-2">
              <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      {/* How It Works - SMOOTH ANIMATION */}
<section className="min-h-screen py-32 relative">
  <div className="max-w-6xl mx-auto px-6">
    <h2 className="text-6xl font-black text-center mb-24 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
      HOW IT WORKS
    </h2>

    <div className="absolute left-1/2 top-48 bottom-0 w-1 bg-gradient-to-b from-purple-500/50 to-transparent -translate-x-1/2" />

    {steps.map((step, index) => (
      <div
        key={index}
        ref={el => stepsRef.current[index] = el}
        data-step-index={index}
        className="mb-32"
      >
        <div 
          className={`flex items-center gap-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'} transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] smooth-transform ${
            visibleSteps.has(index)
              ? 'opacity-100 translate-x-0' 
              : `opacity-0 ${index % 2 === 0 ? '-translate-x-24' : 'translate-x-24'}`
          }`}
        >
          {/* Icon */}
          <div className={`relative flex-shrink-0 transition-all duration-700 ${
            visibleSteps.has(index) ? 'scale-110' : 'scale-100'
          }`}>
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-5xl relative z-10 shadow-2xl shadow-purple-500/50">
              {step.icon}
            </div>
            {visibleSteps.has(index) && (
              <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
            )}
          </div>

          {/* Content */}
          <div className={`flex-1 bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-8 transition-all duration-700 ${
            visibleSteps.has(index) ? 'shadow-2xl shadow-purple-500/20 border-purple-500/50' : ''
          }`}>
            <h3 className="text-4xl font-black mb-4 text-purple-300">
              {step.title}
            </h3>
            <p className="text-xl text-slate-300 leading-relaxed">
              {step.desc}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
</section>

      {/* Top Players - FIXED */}
      <section className="min-h-screen py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-6xl font-black text-center mb-8 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            HALL OF LEGENDS
          </h2>
          <p className="text-center text-slate-400 text-xl mb-24">
            Meet the warriors who conquered the battlefield
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {topUsers.map((topUser, index) => (
              <div
key={topUser._id || index}
className="group relative fade-up smooth-transform"
style={{
animationDelay:`${index*0.15}s`
}}
>
                {index === 0 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-black shadow-2xl shadow-yellow-500/50">
                      👑
                    </div>
                  </div>
                )}

                <div className={`relative h-full bg-gradient-to-br ${
                  index === 0 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/30' :
                  index === 1 ? 'from-slate-400/10 to-slate-600/10 border-slate-400/30' :
                  'from-orange-600/10 to-red-600/10 border-orange-500/30'
                } border-2 rounded-3xl p-8 backdrop-blur-sm hover:scale-105 transition-all duration-500`}>

                  {/* ✅ FIXED - Now synchronous */}
                  {isMyProfile(topUser) && (
                    <button
                      onClick={() => {
                        setEditingBio(topUser._id);
                        setNewBio(topUser.bio || '');
                      }}
                      className="absolute top-4 right-4 w-10 h-10 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center transition-all"
                    >
                      ✏️
                    </button>
                  )}

                  <div className={`absolute top-4 ${isMyProfile(topUser) ? 'left-4' : 'right-4'} text-6xl font-black ${
                    index === 0 ? 'text-yellow-500/20' :
                    index === 1 ? 'text-slate-400/20' :
                    'text-orange-500/20'
                  }`}>
                    #{index + 1}
                  </div>

                  <div className="text-7xl mb-4 text-center mt-8">{topUser.profilePic || '👤'}</div>
                  
                  {/* ✅ FIXED - Use topUser.username */}
                  <h3 className="text-3xl font-black mb-2 text-center">{topUser.username}</h3>
                  <div className="text-purple-400 font-bold mb-4 text-center">
                    Level {topUser.level} • {topUser.stats?.wins || 0} Wins
                  </div>
                
                  {/* ✅ FIXED - Closing tags */}
                  {editingBio === topUser._id ? (
                    <div className="space-y-3">
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        maxLength={500}
                        placeholder="Write your story..."
                        className="w-full px-4 py-3 bg-slate-800 border border-purple-500 rounded-xl text-white resize-none"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateBio(topUser._id)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBio(null)}
                          className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-300 leading-relaxed text-center">
                      {topUser.bio || 'No story yet...'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950/50 backdrop-blur-xl border-t border-purple-500/20 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="text-3xl font-black mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ShastrAi
              </h3>
              <p className="text-slate-400 leading-relaxed">
                The future of competitive learning. Built by students, for students.
              </p>
            </div>

            <div>
              <h4 className="text-xl font-bold mb-4 text-purple-300">CONTACT</h4>
              <div className="space-y-3 text-slate-400">
                <p>📧 support@shastrai.com</p>
                <p>💬 Discord: ShastrAi#2024</p>
                <p>🐛 Report Bugs</p>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-bold mb-4 text-purple-300">FOLLOW US</h4>
              <div className="flex gap-4">
                {['𝕏', '📷', '💼', '🎮'].map((icon, i) => (
                  <a 
                    key={i}
                    href="#" 
                    className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-2xl transition-all hover:scale-[1.05] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-8 text-center text-slate-500">
            <p>© 2024 ShastrAi. Built with 💜 by warriors for warriors.</p>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemo && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowDemo(false)}
        >
          <div 
            className="bg-slate-900 rounded-3xl p-12 max-w-4xl w-full border-2 border-purple-500/30 relative"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowDemo(false)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-2xl"
            >
              ✕
            </button>
            
            <h3 className="text-5xl font-black mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              HOW TO PLAY
            </h3>
            
            <div className="aspect-video bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-purple-500/20">
              <div className="text-center">
                <div className="text-6xl mb-4">🎬</div>
                <p className="text-slate-400">Demo video placeholder</p>
              </div>
            </div>

            <p className="text-slate-300 text-lg leading-relaxed">
              Watch how top players dominate the battlefield!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}