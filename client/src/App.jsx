import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import SocketListener from "./components/SocketListener";
import { BACKEND_URL } from "./config";

import HomePage from "./components/HomePage";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import GamePage from "./components/GamePage";
import WaitingRoom from "./components/Waitingroom";
import GameRoom from "./components/Gameroom";
import GameResults from "./components/Gameresults";
import NotificationPage from './components/NotificationsPage';

// Add this component in App.jsx above the function
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

    useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          withCredentials: true,
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.data.success) {
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // 2. Create socket whenever user becomes available
  useEffect(() => {
    if (!user || socketRef.current) return;

    socketRef.current = io(`${BACKEND_URL}`, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Socket connected:', socketRef.current.id);
      socketRef.current.emit('user:online', {
        userId: user._id,
        username: user.username,
        level: user.level ?? 1,
      });
      setSocket(socketRef.current);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-black text-2xl font-bold animate-pulse">
          Checking Authentication...
        </div>
      </div>
    );
  }
  return (
    <BrowserRouter>
    <SocketListener socket={socket} user={user} />
      <Routes>
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage setUser={setUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
        <Route path="/game" element={user ? <GamePage socket={socket} user={user} /> : <Navigate to="/auth" />} />
        <Route path="/waiting-room" element={user ? <WaitingRoom socket={socket} user={user} /> : <Navigate to="/auth" />} />
        <Route path="/game-room" element={user ? <GameRoom socket={socket} user={user} /> : <Navigate to="/auth" />} />
        <Route path="/game-results" element={user ? <GameResults socket={socket} user={user} /> : <Navigate to="/auth" />} />
        <Route path="/notifications" element={user ? <NotificationPage socket={socket} user={user} /> : <Navigate to="/auth" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;