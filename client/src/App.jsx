import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import SocketListener from "./components/SocketListener";

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
      console.log('checkAuth started');
      try {
        const res = await axios.get(
          "http://localhost:5000/api/auth/me",
          { withCredentials: true,
            headers: {
      'Cache-Control': 'no-cache'
           }
          }
        );
            console.log('response status:', res.status);
            console.log('response data:', res.data);
        if (res.data.success) {
          const userData = res.data.user;
          console.log('setting user:', res.data.user.username);
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));

          // Connect socket once and mark user online
       if (!socketRef.current) {
         socketRef.current = io('http://localhost:5000', {
           withCredentials: true,
           transports: ['websocket', 'polling']
         });
       
         socketRef.current.on('connect', () => {
           console.log('🔌 Socket connected:', socketRef.current.id);
           socketRef.current.emit('user:online', {
             userId: userData._id,
             username: userData.username,
             level: userData.level ?? 1,
           });
           setSocket(socketRef.current); // ← add this, triggers re-render with socket ready
         });
          }
        }
        else {
      console.log('success was false or user missing');
    }
  } catch (err) {
        console.log('Error type:', err.constructor.name);
        console.log('Error message:', err.message);
        console.log('Has response:', !!err.response);
        console.log('Response status:', err.response?.status);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
   console.log('App user state:', user);
    // When user closes tab or browser → socket disconnects → backend marks offline

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

 useEffect(() => {
  console.log('user state changed:', user);
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