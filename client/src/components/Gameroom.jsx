import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';
// ── OUTSIDE GameRoom function — at the top of the file ──
// ── OUTSIDE GameRoom function — at the top of the file ──
// ─────────────────────────────────────────────
// TRUTH & DARE WHEEL COMPONENT
// ─────────────────────────────────────────────
const TruthDareWheel = ({ strips, turnOrder, allPlayers, spinning, landedIndex }) => {
  const wheelRef = useRef(null);
  const prevSpinRef = useRef(0);

  const STRIP_COUNT = 8;
  const STRIP_ANGLE = 360 / STRIP_COUNT; // 45deg each

  // Map turnNumber → player username for label
  const getLabel = (turnNumber) => {
    const entry = turnOrder.find(t => t.turnNumber === turnNumber);
    if (!entry) return `#${turnNumber}`;
    const player = allPlayers.find(p => p.userId === entry.userId);
    return player ? player.username.slice(0, 8) : `#${turnNumber}`;
  };

  // Strip colors — alternating two tones
  const COLORS = [
    { bg: '#2d1b69', border: '#7c3aed', text: '#c4b5fd' },
    { bg: '#1e1b4b', border: '#4f46e5', text: '#a5b4fc' },
    { bg: '#3b0764', border: '#9333ea', text: '#d8b4fe' },
    { bg: '#1a1040', border: '#6d28d9', text: '#ede9fe' },
    { bg: '#2e1065', border: '#7c3aed', text: '#c4b5fd' },
    { bg: '#1e1b4b', border: '#4338ca', text: '#a5b4fc' },
    { bg: '#4a044e', border: '#a21caf', text: '#f0abfc' },
    { bg: '#1a1040', border: '#6d28d9', text: '#ede9fe' },
  ];

  useEffect(() => {
    if (!wheelRef.current) return;
    if (spinning && landedIndex !== null) {
      // Each strip is 45deg. Pointer is at top (270deg offset from 0).
      // To land strip[landedIndex] under pointer:
      // strip i center is at: i * 45 + 22.5 degrees from wheel's 0
      // We need that center to be at 270deg (top) after rotation
      // So rotation = 270 - (landedIndex * 45 + 22.5) + 360 * extraSpins
      const extraSpins = 5; // minimum full rotations for drama
      const targetAngle = 270 - (landedIndex * STRIP_ANGLE + STRIP_ANGLE / 2);
      const finalRotation = prevSpinRef.current + extraSpins * 360 + ((targetAngle - prevSpinRef.current % 360 + 360) % 360);
      
      wheelRef.current.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 1)';
      wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
      prevSpinRef.current = finalRotation;
    }
  }, [spinning, landedIndex]);

  // Build SVG wheel — conic sectors
  const buildSectors = () => {
    const cx = 160, cy = 160, r = 148;
    const sectors = [];

    for (let i = 0; i < STRIP_COUNT; i++) {
      const startAngle = i * STRIP_ANGLE - 90; // offset so 0 is at top
      const endAngle = startAngle + STRIP_ANGLE;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const midAngle = startAngle + STRIP_ANGLE / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelR = r * 0.68;
      const lx = cx + labelR * Math.cos(midRad);
      const ly = cy + labelR * Math.sin(midRad);

      const col = COLORS[i % COLORS.length];
      const turnNum = strips[i];

      sectors.push(
        <g key={i}>
          <path
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
            fill={col.bg}
            stroke={col.border}
            strokeWidth="1.5"
          />
          {/* Turn number — large */}
          <text
            x={lx}
            y={ly - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${midAngle + 90}, ${lx}, ${ly - 8})`}
            fill={col.text}
            fontSize="18"
            fontWeight="700"
            fontFamily="'Space Mono', monospace"
          >
            {turnNum}
          </text>
          {/* Username — small */}
          <text
            x={lx}
            y={ly + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${midAngle + 90}, ${lx}, ${ly + 10})`}
            fill={col.text}
            fontSize="8"
            fontWeight="400"
            fontFamily="'Space Mono', monospace"
            opacity="0.7"
          >
            {getLabel(turnNum)}
          </text>
        </g>
      );
    }
    return sectors;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px', userSelect: 'none' }}>
      {/* Pointer — fixed triangle at top */}
      <div style={{ position: 'relative', zIndex: 10, marginBottom: '-16px' }}>
        <svg width="32" height="28" viewBox="0 0 32 28">
          <polygon
            points="16,28 0,0 32,0"
            fill="#7c3aed"
            stroke="#a855f7"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon
            points="16,22 6,4 26,4"
            fill="#a855f7"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Wheel wrapper — outer glow ring */}
      <div style={{
        borderRadius: '50%',
        padding: '4px',
        background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed)',
        boxShadow: spinning ? '0 0 40px rgba(168,85,247,0.5)' : '0 0 20px rgba(168,85,247,0.2)',
        transition: 'box-shadow 0.5s ease',
      }}>
        <div style={{
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#0a0a18',
          width: '320px',
          height: '320px',
        }}>
          <svg
            ref={wheelRef}
            viewBox="0 0 320 320"
            width="320"
            height="320"
            style={{ display: 'block' }}
          >
            {/* Outer ring */}
            <circle cx="160" cy="160" r="158" fill="none" stroke="rgba(168,85,247,0.3)" strokeWidth="2" />
            
            {/* Sectors */}
            {buildSectors()}

            {/* Center circle */}
            <circle cx="160" cy="160" r="28" fill="#0f0a1e" stroke="#7c3aed" strokeWidth="2" />
            <circle cx="160" cy="160" r="20" fill="#1a0d3d" stroke="#a855f7" strokeWidth="1" />
            <text
              x="160" y="160"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#a855f7"
              fontSize="10"
              fontWeight="700"
              fontFamily="'Space Mono', monospace"
            >
              T&D
            </text>

            {/* Divider lines */}
            {Array.from({ length: STRIP_COUNT }).map((_, i) => {
              const angle = (i * STRIP_ANGLE - 90) * Math.PI / 180;
              return (
                <line
                  key={i}
                  x1={160 + 28 * Math.cos(angle)}
                  y1={160 + 28 * Math.sin(angle)}
                  x2={160 + 148 * Math.cos(angle)}
                  y2={160 + 148 * Math.sin(angle)}
                  stroke="rgba(168,85,247,0.25)"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Spinning status */}
      <div style={{
        marginTop: '16px',
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.65rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: spinning ? '#a855f7' : 'rgba(255,255,255,0.2)',
        transition: 'color 0.3s ease',
      }}>
        {spinning ? '⟳ spinning...' : 'waiting for spin'}
      </div>
    </div>
  );
};
const StarRating = ({ playerId, questionNumber, question, existingRating, onRate }) => {
  const [hovered, setHovered] = useState(0);
  const rated = existingRating != null;

  return (
    <div className="mt-2 px-2 py-1.5 bg-slate-800/80 border border-white/5 rounded-xl">
      <p className="text-[9px] text-slate-400 mb-1 leading-tight">Rate based on this discussion</p>
      <div className="flex gap-0.5 justify-center">
        {[1,2,3,4,5].map(star => (
          <button
            key={star}
            disabled={rated}
            onMouseEnter={() => !rated && setHovered(star)}
            onMouseLeave={() => !rated && setHovered(0)}
            onClick={() => !rated && onRate(playerId, star, questionNumber, question)}
            className={`text-base transition-transform ${!rated ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
          >
            <span className={
              star <= (hovered || existingRating || 0)
                ? 'text-amber-400'
                : 'text-slate-600'
            }>★</span>
          </button>
        ))}
      </div>
      {rated && (
        <p className="text-[9px] text-emerald-400 text-center mt-0.5">Rated ✓</p>
      )}
    </div>
  );
};

const PlayerTile = React.memo(({ 
  player, isMe, isMine, 
  videoEnabled, voiceEnabled,
  localVideoRef, remoteStreams, remoteVideoStates,
  speakingRingRefs, playersInGame,
  onAddFriend, onReport, onShowProfile,
  // rating props
  showRating, currentQuestion, questionNumber, ratings, onRate,
}) => {
  const stream = isMe ? null : remoteStreams?.[player.userId];
  // ✅ Fix: check if remote video track is actually active (not just stream exists)
  const hasActiveVideo = stream && stream.getVideoTracks().some(
    t => t.enabled && t.readyState === 'live'
  ) && remoteVideoStates?.[player.userId] !== false;

  const isOnline = isMe || playersInGame.includes(player.userId);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (remoteVideoRef.current && stream) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ✅ Fix: when video goes inactive, clear srcObject so no frozen frame
  useEffect(() => {
    if (!hasActiveVideo && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [hasActiveVideo]);

  const existingRating = ratings?.[`${player.userId}_${questionNumber}`];

  return (
    <div
      className="relative group cursor-pointer transition-all duration-300"
      onClick={() => !isMe && onShowProfile(player)}
    >
      {/* Speaking ring */}
      <div
        ref={el => { if (el && speakingRingRefs?.current) speakingRingRefs.current[player.userId] = el; }}
        className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400 ring-offset-2 z-10 pointer-events-none transition-opacity duration-100"
        style={{ opacity: 0 }}
      />

      <div className={`relative rounded-2xl overflow-hidden border ${
        isMine ? 'border-violet-500/30' : 'border-amber-500/20'
      } bg-slate-900/60 backdrop-blur-sm`}>

        <div className="aspect-square relative">
          {isMe && videoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : !isMe && hasActiveVideo ? (
            // ✅ Fix: only show video element when track is actually live
            <video
              ref={remoteVideoRef}
              autoPlay playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // ✅ Fix: always fall back to avatar — no frozen frames
            <div className={`w-full h-full flex items-center justify-center text-4xl ${
              isMine
                ? 'bg-gradient-to-br from-violet-800/50 to-purple-900/50'
                : 'bg-gradient-to-br from-amber-900/40 to-orange-900/40'
            }`}>
              {player.avatar || '👤'}
            </div>
          )}

          {!isOnline && !isMe && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-mono">OFFLINE</span>
            </div>
          )}

          {/* Waveform */}
          <div
            ref={el => { if (el && speakingRingRefs?.current) speakingRingRefs.current[`wave_${player.userId}`] = el; }}
            className="absolute bottom-2 left-2 flex gap-0.5 items-end transition-opacity duration-100"
            style={{ opacity: 0 }}
          >
            {[3,5,4,6,3].map((h, i) => (
              <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce"
                style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>

          <div className="absolute bottom-2 right-2 flex gap-1">
            {isMe && !voiceEnabled && (
              <div className="w-5 h-5 bg-red-600/90 rounded-full flex items-center justify-center text-xs">🔇</div>
            )}
            {isMe && !videoEnabled && (
              <div className="w-5 h-5 bg-red-600/90 rounded-full flex items-center justify-center text-xs">📵</div>
            )}
            {/* Show video-off badge for remote player */}
            {!isMe && remoteVideoStates?.[player.userId] === false && (
              <div className="w-5 h-5 bg-slate-700/90 rounded-full flex items-center justify-center text-xs">📵</div>
            )}
          </div>
        </div>

        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white truncate max-w-[100px]">
              {isMe ? `${player.username} (You)` : player.username}
            </div>
            <div className="text-[10px] text-slate-500">Lvl {player.level}</div>
          </div>
          {!isMe && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={e => { e.stopPropagation(); onAddFriend(player.userId); }}
                className="w-6 h-6 bg-blue-600/80 hover:bg-blue-500 rounded-full flex items-center justify-center text-xs"
              >➕</button>
              <button
                onClick={e => { e.stopPropagation(); onReport(player.userId); }}
                className="w-6 h-6 bg-red-600/80 hover:bg-red-500 rounded-full flex items-center justify-center text-xs"
              >🚫</button>
            </div>
          )}
        </div>

        {/* ✅ Rating widget — only for opponents, only when a question is active */}
        {!isMe && showRating && currentQuestion && (
          <div onClick={e => e.stopPropagation()}>
            <StarRating
              playerId={player.userId}
              questionNumber={questionNumber}
              question={currentQuestion}
              existingRating={existingRating}
              onRate={onRate}
            />
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.videoEnabled === next.videoEnabled &&
    prev.voiceEnabled === next.voiceEnabled &&
    prev.remoteStreams?.[prev.player.userId] === next.remoteStreams?.[next.player.userId] &&
    prev.remoteVideoStates?.[prev.player.userId] === next.remoteVideoStates?.[next.player.userId] &&
    prev.playersInGame === next.playersInGame &&
    prev.showRating === next.showRating &&
    prev.questionNumber === next.questionNumber &&
    prev.ratings?.[`${prev.player.userId}_${prev.questionNumber}`] === next.ratings?.[`${next.player.userId}_${next.questionNumber}`]
  );
});
export default function GameRoom({ socket, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameData } = location.state || {};

  // ── Game discussion State ──
  const [greetPhase, setGreetPhase] = useState(true);
  const [greetTimer, setGreetTimer] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gameData?.totalQuestions || 10);
  const [nextQuestionVotes, setNextQuestionVotes] = useState(0);
  const [votedForNext, setVotedForNext] = useState(false);
  const [playersInGame, setPlayersInGame] = useState([]);
  const [gameEnded, setGameEnded] = useState(false);

  //truth and dare
  // Truth & Dare specific state
const [ptsReady, setPtsReady] = useState(false);
const [tdReady, setTdReady] = useState(false);
const [tdStrips, setTdStrips] = useState([]);
const [tdTurnOrder, setTdTurnOrder] = useState([]);
const [chitsLeft, setChitsLeft] = useState(0);
const [spinVotes, setSpinVotes] = useState(0);
const [votedForSpin, setVotedForSpin] = useState(false);
const [wheelSpinning, setWheelSpinning] = useState(false);
const [landedIndex, setLandedIndex] = useState(null);
const [landedUserId, setLandedUserId] = useState(null);
const [tdPrompt, setTdPrompt] = useState(null);  // { choice, prompt }
const [showTruthDareChoice, setShowTruthDareChoice] = useState(false); // only for landed player
const isTruthDare = gameData?.Games === 'Truth and Dare';


const isPassStory = gameData?.Games === 'Pass the Story';

// PTS state
const [ptsStoryLines, setPtsStoryLines] = useState([]);
const [ptsStarter, setPtsStarter] = useState('');
const [ptsStoryInput, setPtsStoryInput] = useState('');
const [ptsMyTurn, setPtsMyTurn] = useState(false); // true when landed player is me
  // ── Players ──
  const [myTeam, setMyTeam] = useState(gameData?.myMembers || []);
  const [opponentTeam, setOpponentTeam] = useState(gameData?.opponentMembers || []);
  const allPlayers = [...myTeam, ...opponentTeam];

  // ── WebRTC ──
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteVideoStates, setRemoteVideoStates] = useState({}); // ✅ tracks if remote video is on/off
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // ── Rating state ──
  // { "userId_questionNumber": starValue }
  const [ratings, setRatings] = useState({});
  
  const speakingRingRefs = useRef({});
  const audioContextsRef = useRef({});

  // ── Chat ──
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // ── UI ──
  const [showPlayerModal, setShowPlayerModal] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [notification, setNotification] = useState(null);

  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // ── Notify helper ──
  const notify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Speaking detection ──
const startSpeakingDetection = useCallback((stream, userId) => {
  try {
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    audioContextsRef.current[userId] = audioCtx;

    const check = () => {
      if (!audioContextsRef.current[userId]) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const speaking = avg > 15;

      // ← Direct DOM manipulation, no React state, no re-render
      const ring = speakingRingRefs.current[userId];
      const wave = speakingRingRefs.current[`wave_${userId}`];
      if (ring) {
        ring.style.opacity = speaking ? '1' : '0';
      }
      if (wave) wave.style.opacity = speaking ? '1' : '0';

      requestAnimationFrame(check);
    };
    check();
  } catch (e) { console.warn('Audio detection error:', e); }
}, []);

  // ── WebRTC: create peer connection ──
  const createPeerConnection = useCallback((targetUserId) => {
    if (peerConnectionsRef.current[targetUserId]) {
      return peerConnectionsRef.current[targetUserId];
    }
    const pc = new RTCPeerConnection(iceConfig);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice', {
          candidate: event.candidate,
          targetUserId,
          fromUserId: user._id,
          gameId: gameData?.gameId,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams(prev => ({ ...prev, [targetUserId]: stream }));
      startSpeakingDetection(stream, targetUserId);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peerConnectionsRef.current[targetUserId];
        setRemoteStreams(prev => {
          const u = { ...prev }; delete u[targetUserId]; return u;
        });
      }
    };

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  }, [socket, user, gameData, startSpeakingDetection]);

  // ── WebRTC: call a peer (always renegotiate — safe to call any time) ──
  const callPeer = useCallback(async (targetUserId) => {
    if (targetUserId === user?._id) return;
    try {
      // Close stale connection so we start fresh with the current stream
      const existing = peerConnectionsRef.current[targetUserId];
      if (existing) {
        const { signalingState, connectionState } = existing;
        // If already in a clean connected state and we're not renegotiating, skip
        if (signalingState === 'stable' && connectionState === 'connected') return;
        // If mid-negotiation, don't interrupt
        if (signalingState !== 'stable' && signalingState !== 'closed') return;
      }
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('webrtc:offer', {
        offer, targetUserId,
        fromUserId: user._id,
        gameId: gameData?.gameId,
      });
    } catch (e) { console.error('callPeer error:', e); }
  }, [createPeerConnection, socket, user, gameData]);

  // ── Force renegotiation with all peers (called after track changes) ──
  const renegotiateAll = useCallback(async () => {
    const others = allPlayers.filter(p => p.userId !== user._id).map(p => p.userId);
    for (const targetUserId of others) {
      try {
        const pc = peerConnectionsRef.current[targetUserId];
        if (!pc || pc.signalingState === 'closed') {
          // No connection yet — do a full callPeer
          await callPeer(targetUserId);
          continue;
        }
        // Connection exists — create a new offer to renegotiate with updated tracks
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc:offer', {
          offer, targetUserId,
          fromUserId: user._id,
          gameId: gameData?.gameId,
        });
      } catch (e) { console.error('renegotiateAll error for', targetUserId, e); }
    }
  }, [allPlayers, callPeer, socket, user, gameData]);

  // ── Start or update local media tracks ──
  // withVideo / withAudio = what we WANT after this call
  const startLocalMedia = useCallback(async (withVideo, withAudio) => {
    try {
      // Stop all existing tracks cleanly before requesting new ones
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: withVideo,
        audio: withAudio,
      });
      localStreamRef.current = stream;

      if (withVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      startSpeakingDetection(stream, user._id);

      // Push updated tracks into every existing peer connection.
      // replaceTrack handles audio (sender already exists from a previous call).
      // For video: if no sender exists yet, addTrack — then renegotiate so the
      // remote side learns about the new track.
      let needsRenegotiation = false;
      Object.values(peerConnectionsRef.current).forEach(pc => {
  if (pc.signalingState === 'closed') return;
  stream.getTracks().forEach(track => {
    const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
    if (sender && track.kind === 'audio') {
      // Audio: replaceTrack is fine, no renegotiation needed
      sender.replaceTrack(track);
    } else if (sender && track.kind === 'video') {
      // ✅ Remove + re-add video so remote ontrack fires again
      pc.removeTrack(sender);
      pc.addTrack(track, stream);
      needsRenegotiation = true;
    } else {
      pc.addTrack(track, stream);
      needsRenegotiation = true;
    }
  });
});

      return { stream, needsRenegotiation };
    } catch (e) {
      notify('Could not access camera/microphone', 'error');
      throw e;
    }
  }, [user, startSpeakingDetection]);

  // ── Toggle video — independent of audio ──

const handleToggleVideo = async () => {
  try {
    if (!videoEnabled) {
      const currentAudio = voiceEnabled;
      await startLocalMedia(true, currentAudio);
      setVideoEnabled(true);
      socket?.emit('webrtc:videoToggle', {
        gameId: gameData?.gameId, userId: user._id, videoEnabled: true,
      });
      // ✅ Wait for replaceTrack to settle before renegotiating
      await new Promise(r => setTimeout(r, 100));
      await renegotiateAll();
    } else {
      // Turn video OFF
      // ✅ Remove video senders from all PCs before stopping tracks
      Object.values(peerConnectionsRef.current).forEach(pc => {
        if (pc.signalingState === 'closed') return;
        pc.getSenders()
          .filter(s => s.track?.kind === 'video')
          .forEach(s => {
            try { pc.removeTrack(s); } catch (e) {}
          });
      });

      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = null;

      if (voiceEnabled) {
        await startLocalMedia(false, true);
      } else {
        localStreamRef.current = null;
      }

      setVideoEnabled(false);
      socket?.emit('webrtc:videoToggle', {
        gameId: gameData?.gameId, userId: user._id, videoEnabled: false,
      });
      await renegotiateAll();
    }
  } catch (e) { console.error('toggleVideo error:', e); }
};

  // ── Toggle voice — independent of video ──
  const handleToggleVoice = async () => {
    try {
      if (!voiceEnabled) {
        // Turn mic ON. Keep current video state — don't touch camera.
        const currentVideo = videoEnabled;
        await startLocalMedia(currentVideo, true);
        setVoiceEnabled(true);
        await renegotiateAll();
      } else {
        // Turn mic OFF — just disable the audio tracks (don't stop them)
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
        setVoiceEnabled(false);
      }
    } catch (e) { console.error('toggleVoice error:', e); }
  };

  // ── Socket: game events ──
  useEffect(() => {
    if (!socket || !gameData) return;

    // Join game room
    socket.emit('game:join', { gameId: gameData.gameId, userId: user._id });

    socket.on('game:playerJoined', ({ userId, activePlayers }) => {
      setPlayersInGame(activePlayers);
      if (userId === user._id) return;
      // Always initiate a peer connection when someone joins, even without local media.
      // createPeerConnection sets up ontrack so we receive their stream regardless of
      // whether we have a local stream ourselves.
      callPeer(userId);
    });


    socket.on('game:discussionQuestion', ({ question, questionNumber, totalQuestions }) => {
      setCurrentQuestion(question);
      setQuestionNumber(questionNumber);
      setTotalQuestions(totalQuestions);
      setVotedForNext(false);
      setNextQuestionVotes(0);
      notify(`Question ${questionNumber} of ${totalQuestions}`, 'info');
    });

    socket.on('game:nextQuestionVote', ({ votes, required }) => {
      setNextQuestionVotes(votes);
    });

    socket.on('game:playerLeft', ({ userId, remainingPlayers }) => {
      setPlayersInGame(remainingPlayers);
      const player = allPlayers.find(p => p.userId === userId);
      notify(`${player?.username || 'A player'} left the game`, 'warning');
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      setRemoteStreams(prev => { const u = { ...prev }; delete u[userId]; return u; });
    });

    socket.on('game:ended', (data) => {
      setGameEnded(true);
      setTimeout(() => navigate('/game-results', { state: { results: data } }), 2000);
    });

    socket.on('game:chat:message', ({ userId, username, message, timestamp }) => {
      setMessages(prev => [...prev, { userId, username, message, timestamp }]);
      if (!chatOpen) setUnreadCount(prev => prev + 1);
    });

    // WebRTC signaling
    socket.on('webrtc:offer', async ({ offer, fromUserId }) => {
      try {
        const pc = createPeerConnection(fromUserId);

        // If we're in the middle of our own offer (have-local-offer), we have a
        // collision. Resolve by whichever userId is lexicographically smaller
        // becoming the "polite" peer that rolls back and accepts the remote offer.
        if (pc.signalingState === 'have-local-offer') {
          const isPolite = user._id < fromUserId;
          if (!isPolite) {
            console.warn('Offer collision — we are impolite, ignoring remote offer');
            return;
          }
          // Polite peer: roll back our local offer and accept the remote one
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          answer, targetUserId: fromUserId,
          fromUserId: user._id, gameId: gameData.gameId,
        });
      } catch (e) {
        console.error('webrtc:offer handler error:', e);
      }
    });

    socket.on('webrtc:answer', async ({ answer, fromUserId }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('webrtc:ice', async ({ candidate, fromUserId }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn('ICE error:', e); }
      }
    });

    // ✅ Fix: listen for remote video toggle → update remoteVideoStates
    socket.on('webrtc:videoToggle', ({ userId, videoEnabled: isOn }) => {
      setRemoteVideoStates(prev => ({ ...prev, [userId]: isOn }));
      // Also disable the video track in the existing stream
      setRemoteStreams(prev => {
        const stream = prev[userId];
        if (stream) {
          stream.getVideoTracks().forEach(t => { t.enabled = isOn; });
        }
        return { ...prev };
      });
    });
    socket.on('game:tdReady', ({ turnOrder, strips, chitsLeft }) => {
  setTdTurnOrder(turnOrder);
  setTdStrips(strips);
  setChitsLeft(chitsLeft);
  setTdReady(true);
});
// ── PASS THE STORY ──
socket.on('game:ptsReady', ({ turnOrder, strips, chitsLeft, storyStarter, storyLines }) => {
  setTdTurnOrder(turnOrder);
  setTdStrips(strips);
  setChitsLeft(chitsLeft);
  setPtsStarter(storyStarter);
  // Use full storyLines if provided (late joiner), else start fresh
  setPtsStoryLines(storyLines?.length ? storyLines : [storyStarter]);
  setPtsReady(true);
});

socket.on('game:ptsNewLine', ({ userId, line, storyLines }) => {
  setPtsStoryLines(storyLines);
  setPtsMyTurn(false);        // safe for everyone — non-landed players already have it false
  setPtsStoryInput('');       // safe for everyone — others have empty input anyway
  setLandedUserId(null);      // ← this is the key one, must run for ALL players
});

socket.on('game:spinVoteUpdate', ({ votes, required }) => {
  setSpinVotes(votes);
});

socket.on('game:wheelResult', ({ landedIndex, landedUserId }) => {
  setWheelSpinning(true);
  setLandedIndex(landedIndex);
  setTimeout(() => {
    setWheelSpinning(false);
    setLandedUserId(landedUserId);
    setVotedForSpin(false);
    setSpinVotes(0);
    if (landedUserId === myUserId) {
      if (isTruthDare) {
        setShowTruthDareChoice(true);
      } else if (isPassStory) {
        setPtsMyTurn(true);  // ← show story input instead of T/D choice
      }
    }
  }, 3000);
});

socket.on('game:tdPrompt', ({ userId, choice, prompt }) => {
  setShowTruthDareChoice(false);
  setTdPrompt({ userId, choice, prompt });
});

socket.on('game:readyToSpin', ({ chitsLeft }) => {
  setChitsLeft(chitsLeft);
  setTdPrompt(null);
  setLandedUserId(null);
  setLandedIndex(null);
});

    return () => {
      socket.off('game:playerJoined');
      socket.off('game:discussionQuestion');
      socket.off('game:nextQuestionVote');
      socket.off('game:playerLeft');
      socket.off('game:ended');
      socket.off('game:chat:message');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice');
      socket.off('webrtc:videoToggle'); // ✅
      socket.off('game:tdReady');
      socket.off('game:spinVoteUpdate');
      socket.off('game:wheelResult');
      socket.off('game:tdPrompt');
      socket.off('game:readyToSpin');
      socket.off('game:ptsReady');
      socket.off('game:ptsNewLine');
    };
  }, [socket, gameData, user, callPeer, createPeerConnection, chatOpen]);

  useEffect(() => {
    socket.on('game:greetPhase', ({ duration }) => {
  setGreetPhase(true);
  setGreetTimer(duration);
  let t = duration;
  const iv = setInterval(() => {
    t--;
    setGreetTimer(t);
    if (t <= 0) { clearInterval(iv); setGreetPhase(false); }
  }, 1000);
});
return ()=> {
  socket.off('game:greetPhase');
};
  }, []);
// Sync local video element whenever the stream or videoEnabled state changes.
// This is the single source of truth for the local preview — toggle handlers
// don't set srcObject themselves so we never get conflicts.
useEffect(() => {
  if (!localVideoRef.current) return;
  if (videoEnabled && localStreamRef.current) {
    localVideoRef.current.srcObject = localStreamRef.current;
  } else {
    localVideoRef.current.srcObject = null;
  }
}, [videoEnabled]);
  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      Object.values(audioContextsRef.current).forEach(ctx => ctx.close());
      peerConnectionsRef.current = {};
      audioContextsRef.current = {};
    };
  }, []);

  // ── Chat scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVoteNextQuestion = () => {
    if (votedForNext || !socket) return;
    setVotedForNext(true);
    socket.emit('game:voteNextQuestion', { gameId: gameData?.gameId, userId: user._id });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;
    socket.emit('game:chat:send', {
      gameId: gameData?.gameId,
      userId: user._id,
      username: user.username,
      message: newMessage.trim(),
    });
    setNewMessage('');
  };

  const handleLeaveGame = () => {
    socket?.emit('game:leave', { gameId: gameData?.gameId, userId: user._id });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    navigate('/dashboard');
  };

  const handleAddFriend = async (toUserId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/friend/request`,
        { toUserId : toUserId }, { withCredentials: true });
      notify('Friend request sent!', 'success');
    } catch (e) {
      notify(e.response?.data?.message || 'Failed to send request', 'error');
    }
  };

  const handleReport = (targetUserId) => {
    notify('Report submitted', 'success');
    // TODO: implement report endpoint
  };

  // ── Rating handler ──
  const handleRate = (ratedUserId, stars, qNumber, question) => {
    const key = `${ratedUserId}_${qNumber}`;
    if (ratings[key] != null) return; // already rated

    setRatings(prev => ({ ...prev, [key]: stars }));

    // Emit to server — stored in Redis, flushed to MongoDB on game end
    socket?.emit('game:ratePlayer', {
      gameId: gameData?.gameId,
      raterUserId: user._id,
      ratedUserId,
      stars,
      questionNumber: qNumber,
      question,
    });

    notify(`Rated ★${stars}`, 'success');
  };

  const myUserId = user?._id;
  const totalVoters = allPlayers.length;
  

  return (
    <div className="min-h-screen bg-[#070711] text-white flex flex-col overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        
        .font-display { font-family: 'Syne', sans-serif; }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,0); }
          50% { box-shadow: 0 0 20px 4px rgba(167,139,250,0.15); }
        }
        .animate-slide-up { animation: slideUp 0.4s ease-out; }
        .animate-slide-right { animation: slideInRight 0.3s ease-out; }
        .animate-fade { animation: fadeIn 0.3s ease-out; }
        .glow-pulse { animation: pulse-glow 3s ease-in-out infinite; }
        
        .glass {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-[120px]" />
      </div>

      {/* ── NOTIFICATION TOAST ── */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium animate-slide-up
          ${notification.type === 'success' ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-700/50' :
            notification.type === 'error' ? 'bg-red-900/90 text-red-300 border border-red-700/50' :
            notification.type === 'warning' ? 'bg-amber-900/90 text-amber-300 border border-amber-700/50' :
            'bg-slate-800/90 text-slate-300 border border-slate-700/50'}`}>
          {notification.msg}
        </div>
      )}

      {/* ── GREET PHASE OVERLAY ── */}
    
{greetPhase && (
  <div className="w-full bg-violet-900/30 border-b border-violet-500/30 px-6 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-xl">👋</span>
      <div>
        <span className="font-semibold text-violet-300 text-sm">Meet your discussants</span>
        <span className="text-slate-400 text-xs ml-2">— First question drops soon. Turn on camera to say hello!</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {/* Mini media buttons in banner */}
      <button
        onClick={handleToggleVideo}
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all ${
          videoEnabled ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
      >
        {videoEnabled ? '📹' : '📵'}
      </button>
      <button
        onClick={handleToggleVoice}
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all ${
          voiceEnabled ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
      >
        {voiceEnabled ? '🎤' : '🔇'}
      </button>
      {/* Countdown */}
      <div className="ml-3 w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
        <span className="font-display font-bold text-violet-300 text-sm tabular-nums">
          {greetTimer}s
        </span>
      </div>
    </div>
  </div>
)}

      {/* ── GAME ENDED ── */}
      {gameEnded && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center animate-fade">
          <div className="text-center">
            <div className="text-6xl mb-4">🏁</div>
            <h2 className="font-display text-4xl font-bold">Discussion Complete</h2>
            <p className="text-slate-400 mt-2">Redirecting to results...</p>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT PANEL — My Team */}
        <div className="w-52 flex-shrink-0 p-4 flex flex-col gap-3 border-r border-white/5">
          <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-1">
            Your Team
          </div>
          {myTeam.map(player => (
            <PlayerTile
            key={player.userId}
              player={player}
              isMe={player.userId === myUserId}
              isMine={true}
              videoEnabled={videoEnabled}
             voiceEnabled={voiceEnabled}
             localVideoRef={localVideoRef}
             remoteStreams={remoteStreams}
             remoteVideoStates={remoteVideoStates}
             speakingRingRefs={speakingRingRefs}
             playersInGame={playersInGame}
             onAddFriend={handleAddFriend}
             onReport={handleReport}
             onShowProfile={setShowPlayerModal}
             myUserId={myUserId}
             showRating={false}
            />
          ))}
        </div>

        {/* CENTER — Main content */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 gap-4 overflow-y-auto">

          {/* Topic badge */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="glass px-4 py-2 rounded-full text-xs text-slate-400">
                <span className="text-violet-400 font-semibold">{gameData?.topic}</span>
                <span className="mx-2 text-slate-600">·</span>
                Discussion
                <span className="mx-2 text-slate-600">·</span>
                {gameData?.totalQuestions} questions
              </div>
              <div className="glass px-4 py-2 rounded-full text-xs text-slate-500">
                {playersInGame.length}/{totalVoters} online
              </div>
            </div>
          </div>

          {/* Question card */}
          <div className="w-full max-w-2xl flex-1 flex flex-col items-center justify-center gap-6">
          {isPassStory ? (
  ptsReady && (
    <div className="w-full flex flex-col items-center gap-6">

      {/* Chits counter */}
      <div className="glass px-6 py-2 rounded-full text-sm text-violet-300">
        🎴 {chitsLeft} Rounds remaining
      </div>

      {/* THE WHEEL — reused, same component */}
      <TruthDareWheel
        strips={tdStrips}
        turnOrder={tdTurnOrder}
        allPlayers={allPlayers}
        spinning={wheelSpinning}
        landedIndex={landedIndex}
      />

      {/* Running story scroll */}
      <div className="glass rounded-2xl p-4 w-full max-w-md max-h-48 overflow-y-auto flex flex-col gap-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
          The Story So Far
        </div>
        {ptsStoryLines.map((line, i) => (
          <p key={i} className={`text-sm leading-relaxed ${
            i === 0 ? 'text-violet-300 font-semibold' : 'text-slate-300'
          }`}>
            {i === 0 ? '📖 ' : `✍️ `}{line}
          </p>
        ))}
      </div>

      {/* Story input — only for landed player */}
      {ptsMyTurn && (
        <div className="w-full max-w-md flex flex-col gap-3">
          <p className="text-center text-sm text-amber-400 font-semibold">
            🎯 Your turn! Add the next line to the story.
          </p>
          <textarea
            value={ptsStoryInput}
            onChange={e => setPtsStoryInput(e.target.value)}
            placeholder="Continue the story..."
            rows={3}
            className="w-full px-4 py-3 glass rounded-xl text-sm text-white placeholder-slate-600 outline-none resize-none border border-violet-500/30 focus:border-violet-500/60 transition-all"
          />
          <button
            onClick={() => {
              if (!ptsStoryInput.trim()) return;
              socket.emit('game:submitStoryLine', {
                gameId: gameData.gameId,
                userId: myUserId,
                line: ptsStoryInput.trim(),
              });
              // After submitting, signal done
              socket.emit('game:ptsDone', { gameId: gameData.gameId });
              setPtsMyTurn(false);
              setPtsStoryInput('');
            }}
            className="px-8 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold"
          >
            Submit Line ✓
          </button>
        </div>
      )}

      {/* Spin voting — only when no one's writing */}
      {!ptsMyTurn && !wheelSpinning && landedUserId === null && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {allPlayers.map((p, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${
                i < spinVotes ? 'bg-emerald-400' : 'bg-slate-700'
              }`} />
            ))}
            <span>{spinVotes}/{allPlayers.length} ready</span>
          </div>
          <button
            onClick={() => {
              if (votedForSpin) return;
              setVotedForSpin(true);
              socket.emit('game:voteSpin', { gameId: gameData.gameId, userId: myUserId });
            }}
            disabled={votedForSpin}
            className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
              votedForSpin
                ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 cursor-default'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {votedForSpin ? '✓ Ready' : '🎡 Spin'}
          </button>
        </div>
      )}

    </div>
  )
) : isTruthDare ? (
  // ... your existing TD block unchanged{isTruthDare ? (
  // ── TRUTH & DARE CENTER ──
  tdReady && (
    <div className="w-full flex flex-col items-center gap-6">
      
      {/* Chits counter */}
      <div className="glass px-6 py-2 rounded-full text-sm text-violet-300">
        🎴 {chitsLeft} Chits remaining
      </div>

      {/* THE WHEEL */}
      <TruthDareWheel
        strips={tdStrips}
        turnOrder={tdTurnOrder}
        allPlayers={allPlayers}
        spinning={wheelSpinning}
        landedIndex={landedIndex}
      />

      {/* Prompt display — shown to everyone after wheel lands and player picks */}
      {tdPrompt && (
        <div className="glass rounded-2xl p-6 text-center w-full max-w-md">
          <div className="text-xs text-slate-600 uppercase tracking-widest mb-1">
      {(() => {
        const p = allPlayers.find(pl => pl.userId === landedUserId);
        return p ? `${p.username}'s turn` : '';
      })()}
    </div>
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">
            {tdPrompt.choice === 'truth' ? '🤍 Truth' : '🔥 Dare'}
          </div>
          <div className="text-xl font-display font-bold">{tdPrompt.prompt}</div>
          {landedUserId === myUserId && (
            <button
              onClick={() => socket.emit('game:tdDone', { gameId: gameData.gameId })}
              className="mt-4 px-8 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold"
            >
              Done ✓
            </button>
          )}
        </div>
      )}

      {/* Spin voting — only shown when no prompt is active */}
      {!tdPrompt && !wheelSpinning && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {allPlayers.map((p, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < spinVotes ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            ))}
            <span>{spinVotes}/{allPlayers.length} ready</span>
          </div>
          <button
            onClick={() => {
              if (votedForSpin) return;
              setVotedForSpin(true);
              socket.emit('game:voteSpin', { gameId: gameData.gameId, userId: myUserId });
            }}
            disabled={votedForSpin}
            className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
              votedForSpin
                ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 cursor-default'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {votedForSpin ? '✓ Ready to Spin' : '🎡 Spin'}
          </button>
        </div>
      )}
    </div>
  )
) :          (currentQuestion ? (
              <div className="w-full animate-slide-up">
                {/* Question number */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-violet-500/30" />
                  <span className="text-[10px] text-violet-400 font-mono uppercase tracking-widest">
                    Question {questionNumber} / {totalQuestions}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-violet-500/30" />
                </div>

                {/* The question */}
                <div className="glass rounded-2xl p-8 text-center glow-pulse">
                  <div className="text-2xl font-display font-bold leading-snug text-white mb-2">
                    {currentQuestion}
                  </div>
                  <p className="text-slate-500 text-sm mt-4">
                    Discuss freely — use voice or chat
                  </p>
                </div>

                {/* NEXT QUESTION voting */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  {/* Vote progress */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex gap-1">
                      {allPlayers.map((p, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                          i < nextQuestionVotes ? 'bg-emerald-400' : 'bg-slate-700'
                        }`} />
                      ))}
                    </div>
                    <span>{nextQuestionVotes}/{totalVoters} ready</span>
                  </div>

                  <button
                    onClick={handleVoteNextQuestion}
                    disabled={votedForNext}
                    className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      votedForNext
                        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 cursor-default'
                        : 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {votedForNext ? '✓ Voted for next question' : 'Next Question →'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center animate-fade">
                <div className="text-5xl mb-4 animate-bounce">⏳</div>
                <p className="font-display text-xl font-bold text-slate-300">
                  {greetPhase ? 'Get ready...' : 'Loading first question...'}
                </p>
                <p className="text-slate-600 text-sm mt-2">AI is preparing your discussion topic</p>
              </div>
           ) 
           )}
          </div>

          {/* Bottom spacer */}
          <div className="h-4" />
        </div>

        {/* RIGHT PANEL — Opponents */}
        <div className="w-52 flex-shrink-0 p-4 flex flex-col gap-3 border-l border-white/5">
          <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">
            Opponents
          </div>
          {opponentTeam.map(player => (
            <PlayerTile
              key={player.userId}
              player={player}
              isMe={player.userId === myUserId}
              isMine={false}
               videoEnabled={videoEnabled}
              voiceEnabled={voiceEnabled}
              localVideoRef={localVideoRef}
              remoteStreams={remoteStreams}
              remoteVideoStates={remoteVideoStates}
              speakingRingRefs={speakingRingRefs}
              playersInGame={playersInGame}
              onAddFriend={handleAddFriend}
              onReport={handleReport}
              onShowProfile={setShowPlayerModal}
              myUserId={myUserId}
              showRating={!!currentQuestion}
              currentQuestion={currentQuestion}
              questionNumber={questionNumber}
              ratings={ratings}
              onRate={handleRate}
            />
          ))}
        </div>
      </div>

      {/* ── FOOTER CONTROLS ── */}
      <div className="border-t border-white/5 bg-slate-950/60 backdrop-blur-xl px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">

          {/* Media controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleVideo}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all duration-200 ${
                videoEnabled
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'glass hover:bg-white/5 text-slate-400'
              }`}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoEnabled ? '📹' : '📵'}
            </button>

            <button
              onClick={handleToggleVoice}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all duration-200 ${
                voiceEnabled
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'glass hover:bg-white/5 text-slate-400'
              }`}
              title={voiceEnabled ? 'Mute' : 'Unmute'}
            >
              {voiceEnabled ? '🎤' : '🔇'}
            </button>

            <button
              onClick={() => { setChatOpen(!chatOpen); setUnreadCount(0); }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all duration-200 relative ${
                chatOpen ? 'bg-violet-600 text-white' : 'glass hover:bg-white/5 text-slate-400'
              }`}
              title="Chat"
            >
              💬
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Game info */}
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider">Topic</div>
              <div className="text-sm font-semibold text-white truncate max-w-[160px]">
                {gameData?.topic}
              </div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider">Progress</div>
              <div className="text-sm font-semibold text-violet-400">
                {questionNumber}/{totalQuestions}
              </div>
            </div>
          </div>

          {/* Leave */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── CHAT SIDEBAR ── */}
      {chatOpen && (
        <div className="fixed right-0 top-0 h-full w-80 bg-[#0a0a18] border-l border-white/5 shadow-2xl z-30 flex flex-col animate-slide-right">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-display text-lg font-bold">In-game Chat</h3>
            <button onClick={() => setChatOpen(false)}
              className="w-7 h-7 rounded-lg glass flex items-center justify-center text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-slate-600 text-xs text-center mt-8">
                No messages yet. Say something!
              </p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.userId === myUserId;
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-600 mb-1 px-1">{msg.username}</span>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[220px] break-words ${
                    isMe
                      ? 'bg-violet-600/30 text-violet-100 border border-violet-500/20'
                      : 'glass text-slate-200'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Message..."
                className="flex-1 px-3 py-2.5 glass rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-violet-500/50 border border-transparent transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 rounded-xl text-sm font-semibold transition-all"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    {/* ── TRUTH & DARE CHOICE MODAL — only shown to landed player ── */}
{showTruthDareChoice && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade">
    <div className="glass rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
      style={{ border: '1px solid rgba(168,85,247,0.3)', boxShadow: '0 0 60px rgba(168,85,247,0.15)' }}>
      
      {/* Header */}
      <div className="text-4xl mb-3">🎯</div>
      <h3 className="font-display text-2xl font-bold mb-1" style={{
        background: 'linear-gradient(135deg, #fff, #a855f7)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
      }}>
        Your Turn!
      </h3>
      <p className="text-slate-400 text-sm mb-8">The wheel landed on you. Choose wisely.</p>

      <div className="flex gap-4">
        {/* TRUTH */}
        <button
          onClick={() => {
            setShowTruthDareChoice(false);
            socket.emit('game:chooseTruthOrDare', {
              gameId: gameData.gameId,
              userId: myUserId,
              choice: 'truth',
            });
          }}
          className="flex-1 py-5 rounded-2xl font-display font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.3)',
            color: '#38bdf8',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
        >
          🤍 Truth
          <p className="text-xs font-normal text-slate-400 mt-1">Answer honestly</p>
        </button>

        {/* DARE */}
        <button
          onClick={() => {
            setShowTruthDareChoice(false);
            socket.emit('game:chooseTruthOrDare', {
              gameId: gameData.gameId,
              userId: myUserId,
              choice: 'dare',
            });
          }}
          className="flex-1 py-5 rounded-2xl font-display font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{
            background: 'rgba(236,72,153,0.1)',
            border: '1px solid rgba(236,72,153,0.3)',
            color: '#ec4899',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(236,72,153,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(236,72,153,0.1)'}
        >
          🔥 Dare
          <p className="text-xs font-normal text-slate-400 mt-1">Accept the challenge</p>
        </button>
      </div>
    </div>
  </div>
)}
      {/* ── LEAVE CONFIRM ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade"
          onClick={() => setShowLeaveConfirm(false)}>
          <div className="glass rounded-2xl p-8 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold mb-2">Leave the discussion?</h3>
            <p className="text-slate-400 text-sm mb-6">
              You can rejoin if the game is still active. The discussion continues without you.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 glass hover:bg-white/5 rounded-xl text-sm font-semibold transition-all">
                Stay
              </button>
              <button onClick={handleLeaveGame}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYER PROFILE MODAL ── */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade"
          onClick={() => setShowPlayerModal(null)}>
          <div className="glass rounded-2xl p-8 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-4xl mx-auto mb-4">
                {showPlayerModal.avatar || '👤'}
              </div>
              <h3 className="font-display text-2xl font-bold">{showPlayerModal.username}</h3>
              <p className="text-slate-500 text-sm mt-1">Level {showPlayerModal.level}</p>
            </div>

            <div className="space-y-2 mb-6">
              {[
                ['XP', showPlayerModal.xp || 0],
                ['Games Played', showPlayerModal.stats?.gamesPlayed || 0],
                ['Wins', showPlayerModal.stats?.wins || 0],
                ['Win Rate', showPlayerModal.stats?.gamesPlayed
                  ? `${Math.round((showPlayerModal.stats.wins / showPlayerModal.stats.gamesPlayed) * 100)}%`
                  : '0%'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center glass px-4 py-3 rounded-xl">
                  <span className="text-slate-500 text-sm">{label}</span>
                  <span className="font-semibold text-sm">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { handleAddFriend(showPlayerModal.userId); setShowPlayerModal(null); }}
                className="flex-1 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-blue-300 rounded-xl text-sm font-semibold transition-all"
              >
                ➕ Add Friend
              </button>
              <button
                onClick={() => { handleReport(showPlayerModal.userId); setShowPlayerModal(null); }}
                className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all"
              >
                🚫 Report
              </button>
            </div>

            <button onClick={() => setShowPlayerModal(null)}
              className="w-full mt-3 py-2.5 glass hover:bg-white/5 rounded-xl text-sm text-slate-400 transition-all">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}