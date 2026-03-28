import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';

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
import { fetchAndCacheTopics } from './utils/Topicservice.js';
import topicRoutes from './routes/Topicroutes.js';
import gameHistory from './routes/Gameoutes.js';
import redis from './config/redis.js';


const REDIS_KEY = 'app:trending_topics';
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
app.use('/api/topics', topicRoutes); 
app.use('/api/question',gameHistory)



// ── Health check ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── MongoDB ──
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
    console.log('✅ MongoDB connected');
 
    // Fetch topics on server boot so they're ready immediately
    
 
    // Refresh every 6 hours: at 00:00, 06:00, 12:00, 18:00
    cron.schedule('0 */6 * * *', async () => {
      console.log('⏰ Cron: refreshing trending topics...');
      const cached = await redis.get(REDIS_KEY);

      if (cached) {
          console.log('⚡ Using cached topics (no API call)');
        } else {
          console.log('🆕 No cache found, fetching topics...');
          await fetchAndCacheTopics();
         }
    });
  })
  .catch((err) => console.error('❌ MongoDB error:', err));

// ── Socket.IO game logic ──
// Temporary — find available models
registerGameSockets(io);

// ── Start ──
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

//TODO -> import node-cron 