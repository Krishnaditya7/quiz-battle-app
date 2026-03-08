import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";

import HomePage from "./components/HomePage";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import GamePage from "./components/GamePage";
import WaitingRoom from "./components/Waitingroom";
import GameRoom from "./components/Gameroom";
import GameResults from "./components/Gameresults";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/auth/me",
          { withCredentials: true }
        );

        if (res.data.success) {
          setUser(res.data.user);
          // Also save to localStorage as backup
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.log('Not authenticated:', err.response?.data?.message);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);  // ← CHANGED FROM true TO false!
      }
    };

    checkAuth();
  }, []);

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
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />

        <Route
          path="/auth"
          element={user ? <Navigate to="/dashboard" /> : <AuthPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/auth" />}
        />

        <Route
          path="/game"
          element={user ? <GamePage /> : <Navigate to="/auth" />}
        />

        <Route
          path="/waiting-room"
          element={user ? <WaitingRoom /> : <Navigate to="/auth" />}
        />

        <Route
          path="/game-room"
          element={user ? <GameRoom /> : <Navigate to="/auth" />}
        />

        <Route
          path="/game-results"
          element={user ? <GameResults /> : <Navigate to="/auth" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;