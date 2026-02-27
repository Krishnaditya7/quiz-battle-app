import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { registerGameSockets } from './utils/socketGameHandler.js';
import authRoutes from './routes/authRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import gameRoutes from './routes/Gameroutes.js';
import friendRoutes from './routes/Friendroutes.js';

dotenv.config();

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
app.use('/api/team', teamRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/friend', friendRoutes);

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