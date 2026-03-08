import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { registerGameSockets } from './utils/socketGameService.js';
import authRoutes from './routes/authRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import messageRoutes from './routes/Messageroutes.js';
import matchRoutes from './routes/Matchroutes.js';
import notificationRoutes from './routes/Notificationroutes.js';
import gameRoutes from './routes/Gameroutes.js';
import friendRoutes from './routes/Friendroutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import { translateToEnglish, computeAIAnswer, generateDiscussionQuestion, judgeDebate } from './utils/aiHelpers.js';

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
app.use('/api/leaderboard', leaderboardRoutes);
app.post('/test/translate', async (req, res) => {
  try {
    const result = await translateToEnglish(req.body.text);
    res.json({ original: req.body.text, translated: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test/answer', async (req, res) => {
  try {
    const result = await computeAIAnswer(req.body.question);
    res.json({ question: req.body.question, answer: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test/discussion', async (req, res) => {
  try {
    const result = await generateDiscussionQuestion(req.body.topic, 1);
    res.json({ topic: req.body.topic, question: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test/debate', async (req, res) => {
  try {
    const result = await judgeDebate(
      'Deforestation',
      'for',
      'against',
      ['Creates jobs', 'Economic growth'],
      ['Destroys ecosystems', 'Climate change']
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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