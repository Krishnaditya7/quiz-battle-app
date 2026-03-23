import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { registerGameSockets } from './utils/socketGameService.js';
import authRoutes from './routes/authRoutes.js';
import messageRoutes from './routes/Messageroutes.js';
import matchRoutes from './routes/Matchroutes.js';
import gameRoutes from './routes/Gameroutes.js';
import friendRoutes from './routes/Friendroutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
 import { createTeamRoutes } from './routes/teamRoutes.js';
import Notificationroutes from './routes/Notificationroutes.js';
import userRoutes from './routes/userRoutes.js'

const app = express();
const httpServer = http.createServer(app);

// ── Socket.IO ──
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Middleware ──
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());   // ← reads JWT from cookies

// ── Routes ──
app.use('/api/auth', authRoutes);
 app.use('/api/team', createTeamRoutes(io));
app.use('/api/chat', messageRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/notification', Notificationroutes);
app.use('/api/game', gameRoutes);
app.use('/api/friend', friendRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/user',userRoutes);



// ── Health check ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── MongoDB ──
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// ── Socket.IO game logic ──
registerGameSockets(io);

// ── Start ──
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

//TODO -> import node-cron 