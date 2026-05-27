// ============================================================
// SOCKET.IO GAME HANDLER — COMPLETE REWRITE WITH TEMP TEAMS
// ============================================================

import { v4 as uuid } from 'uuid';
import redis from '../config/redis.js';
import K from '../config/redisKeys.js';
import * as R from '../utils/redisGameServices.js';
import { saveCompletedGame } from '../controllers/gameController.js';
import User from '../models/Users.js';
import { generateDiscussionQuestion } from './aiHelpers.js';
import Team from '../models/Team.js';
import Message from '../models/Message.js';
import GameHistory from '../models/Gamehistory.js';

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const TRUTH_QUESTIONS = [
  "What's the most embarrassing thing you've done in public?",
  "Who was your first Crush?",
  "What question are you secretly hoping no one asks you?",
  "What is the strangest dream you've ever had",
  "What's your favorite thing about the opposite sex?",
  "If you could be born again would choose to be a different sex to what you are?"
  // ... add as many as you want
];

const DARE_TASKS = [
  "Do your best animal impression for 30 seconds",
  "Sing a song chosen by the group",
  "compliment everyone playing, except for one person and it can't be you",
  " read the last text message you sent out loud",
  
  // ... add as many as you want
];
const Horror = [
  "I was on the bed and suddenly heard the cry of a baby, but there was no baby in my house.",
  "The mirror in my room showed a reflection that was always one second behind me.",
  "I found a door in my basement that wasn't there yesterday — and something was knocking from the other side.",
  "Every night at 3 AM, my phone rings with my own number.",
  "The old photograph on the wall blinked, and I swear I saw it smile.",
];

const Comedy = [
  "A monkey somehow entered the college canteen and started chasing everyone, including the principal.",
  "I accidentally sent my most embarrassing voice note to the entire office group chat instead of my best friend.",
  "My GPS led me straight into a wedding, and somehow I ended up as the best man.",
  "The dog swallowed my grandmother's teeth, and our entire family spent the afternoon following it around the garden.",
  "I tried to impress my date by cooking, but the fire department arrived before the food was ready.",
];

const SCI_FI = [
  "There was something very wrong happening at the GenSci company that worked on gene mutation.",
  "The AI assigned to manage our city quietly rewrote its own purpose at 2:17 AM.",
  "Scientists detected a signal from deep space — and it was a direct reply to a message we sent fifty years ago.",
  "The first human teleported successfully, but the copy on the other end remembered things that hadn't happened yet.",
  "Every citizen over 30 received a notification: 'Your memory backup is ready for review.'",
];

const ROM_COM = [
  "After 30 years of separation, two people wanted to leave their toxic partners and start a new life — on the same day, in the same coffee shop.",
  "She agreed to pretend to be his girlfriend for one weekend family reunion. By Sunday she wasn't pretending anymore.",
  "They hated each other for three years — until the day they were accidentally assigned as roommates.",
  "He showed up at her door in the rain. She was already holding an umbrella and a one-way ticket.",
  "They met on a flight, argued for six hours straight, and landed in the wrong city.",
];

const Family_Drama = [
  "After finding out no one in his family respected him, the boy started looking for ways to earn that respect — no matter the cost.",
  "The will was read out loud at dinner, and nobody touched their food afterward.",
  "She came home after ten years to find her childhood bedroom had been turned into a gym.",
  "The eldest daughter discovered a letter her mother had hidden for twenty years — and it changed everything she believed about their family.",
  "At the reunion, someone finally said the thing that everyone had been avoiding for a decade.",
];

const Action = [
  "The mission was simple — get in, grab the drive, get out. It stopped being simple the moment she recognized the guard.",
  "He had forty-eight hours to clear his name before the wrong people found him first.",
  "The convoy was ambushed at dawn, and only two soldiers were left standing.",
  "She was the only passenger on the last flight out — and someone had just locked the cockpit door from the inside.",
  "The explosion had been a distraction. The real theft happened three floors below.",
];

const Thriller = [
  "A man calmly sat beside a stranger at 1 AM in an airport lounge, leaned over, and whispered: 'Don't turn around.'",
  "She received a text from her own number: 'Leave the building now. Don't ask why.'",
  "The detective stared at the crime scene photos — all six victims had the same look of surprise, as if they'd seen someone they trusted.",
  "Someone had been living in his apartment for weeks. Nothing was taken. Nothing was moved. But the coffee cups were always clean.",
  "The witness protection officer slid a folder across the table. 'The person you're hiding from already knows you're here.'",
];



// ─────────────────────────────────────────────────────────────
// COLLAB REDIS HELPERS
// Collab pool key: collab:{topic}:{questionCount}:{playerCount}
// Each entry is a JSON string pushed to a Redis list.
// An entry represents one "slot contribution" — could be 1 solo
// or N members from a pre-formed team all wanting to collab.
// ─────────────────────────────────────────────────────────────

const collabKey = (Games, topic, questionCount, playerCount) =>
  `collab:${Games}:${topic}:${questionCount}:${playerCount}`;

// Push one collab entry (one or more players) into the staging pool
async function addToCollabPool(Games,topic, questionCount, playerCount, entry) {
  const key = collabKey(Games,topic, questionCount, playerCount);
  await redis.rpush(key, JSON.stringify(entry));
  await redis.expire(key, 300); // 5 min TTL — stale pools auto-clean
}

// Get all entries currently in the collab staging pool
async function getCollabPool(Games,topic, questionCount, playerCount) {
  const key = collabKey(Games,topic, questionCount, playerCount);
  const raw = await redis.lrange(key, 0, -1);
  return raw.map(r => JSON.parse(r));
}

// Atomically replace the entire collab pool (after re-packing)
async function setCollabPool(Games,topic, questionCount, playerCount, entries) {
  const key = collabKey(Games,topic, questionCount, playerCount);
  await redis.del(key);
  if (entries.length > 0) {
    await redis.rpush(key, ...entries.map(e => JSON.stringify(e)));
    await redis.expire(key, 300);
  }
}

// Remove every entry that belongs to a given userId from the pool
async function removeUserFromCollabPool(Games,topic, questionCount, playerCount, userId) {
  const pool = await getCollabPool(Games,topic, questionCount, playerCount);
  const filtered = pool.filter(e => {
    // An entry's "allUserIds" is the flat list of every player it contributes
    return !e.allUserIds.includes(userId);
  });
  await setCollabPool(Games,topic, questionCount, playerCount, filtered);
}

// ─────────────────────────────────────────────────────────────────────────────
export const sendNotificationToUser = async (io, recipientId, notification) => {
  const userData = await R.getUserOnlineData(recipientId);
  if (userData?.socketId) {
    io.to(`user:${recipientId}`).emit('notification:new', { notification });
  }
};

export const registerGameSockets = (io) => {

    redis.config('SET', 'notify-keyspace-events', 'Ex');
    const redisSub = redis.duplicate();
    redisSub.subscribe('__keyevent@0__:expired');

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on('user:online', async ({ userId, username, level }) => {
        socket.userId = userId;
        await R.setUserOnline(userId, socket.id, username, level);
        socket.join(`user:${userId}`);
        console.log(`👤 ${username} is online`);
      });

      // ═══════════════════════════════════════════════════════════════
      // JOIN QUEUE
      // ═══════════════════════════════════════════════════════════════
      socket.on('match:joinQueue', async ({ userId, Games, topic, questionCount, 
        opponentType, playerCount, teamId }) => {
        try {

          // ── Validate ──
          if (!userId || !Games ||(Games !== 'Truth and Dare' && !topic) || !questionCount || !playerCount || !opponentType) {
            return socket.emit('error', { message: 'Missing required fields' });
          }
          if (!['solo', 'duo', 'trio', 'squad', 'default'].includes(opponentType)) {
            return socket.emit('error', { message: 'Invalid opponent type' });
          }
          if (![5, 10, 15, 20].includes(parseInt(questionCount))) {
            return socket.emit('error', { message: 'Invalid question count' });
          }
          if (playerCount < 1 || playerCount > 4) {
            return socket.emit('error', { message: 'playerCount must be 1-4' });
          }

          // ── Already in queue or collab pool? ──
          const existingEntry = await R.getUserQueueEntry(userId);
          if (existingEntry) {
            return socket.emit('error', { message: 'Already in queue. Leave first.' });
          }

          // ── Get user ──
          const user = await User.findById(userId).select('username level class currentTeam');
          if (!user) {
            return socket.emit('error', { message: 'User not found' });
          }
          socket.userId = userId;

          // ── Helper: class string → number ──
          const classToNum = (cls) => {
            if (!cls) return 9;
            if (cls === 'Other' || cls === 'College') return 13;
            const num = parseInt(cls);
            return isNaN(num) ? 9 : num;
          };

          // ════════════════════════════════════
          // ── SOLO PATH ──
          // ════════════════════════════════════
          if (!teamId) {
            await User.findByIdAndUpdate(userId, { $unset: { currentTeam: '' } });

            const parsedPlayerCount = parseInt(playerCount);
            const parsedQuestionCount = parseInt(questionCount);

            // ── playerCount = 1 → skip collab, go straight to queue ──
            if (parsedPlayerCount === 1) {
              await R.addToQueue(userId, {
                username: user.username,
                level: user.level,
                playerClass: user.class || 'Other',
                Games,
                topic,
                questionCount: parsedQuestionCount,
                playerCount: 1,
                opponentType,
                teamId: null,
                onlineTeamMembers: '',
              });

              socket.join(`queue:${Games}:${topic}:${parsedQuestionCount}`);
              socket.emit('match:queued', {
                message: 'Searching for opponent...',
                queueData: {Games, topic, questionCount: parsedQuestionCount, playerCount: 1, opponentType },
                myTeam: {
                  name: user.username,
                  members: [{ username: user.username, level: user.level, avatar: '👤' }],
                },
              });

              console.log(`🎯 Solo queue (1v1): ${user.username}`);
              await tryMatch(io, { Games, topic, playerCount: 1, questionCount: parsedQuestionCount });
              return;
            }

            // ── playerCount > 1 → enter collab staging pool ──
            // This player wants to be grouped with others before facing an opponent.
            console.log(`🤝 Collab queue: ${user.username} wants team of ${parsedPlayerCount}`);

            const myCollabEntry = {
              // Every field needed to eventually build a full queue entry
              allUserIds: [userId],           // all player IDs this entry contributes
              representativeUserId: userId,   // used for queue removal keying
              players: [{
                userId,
                username: user.username,
                level: user.level,
                playerClass: user.class || 'Other',
                avatar: '👤',
              }],
              Games,
              topic,
              questionCount: parsedQuestionCount,
              playerCount: parsedPlayerCount,
              opponentType,
              joinedAt: Date.now(),
            };

            await addToCollabPool(Games, topic, parsedQuestionCount, parsedPlayerCount, myCollabEntry);

            // Track that this user is in the collab pool (so queue:leave can clean it up)
            await redis.set(
              `collab:user:${userId}`,
              JSON.stringify({ Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount }),
              'EX', 300
            );

            socket.join(`collab:${Games}:${topic}:${parsedQuestionCount}:${parsedPlayerCount}`);

            // Immediately tell this player they're in staging
            socket.emit('match:queued', {
              message: `Finding teammates... 1/${parsedPlayerCount} joined`,
              isCollab: true,
              collabSlots: { filled: 1, total: parsedPlayerCount },
              queueData: {Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount, opponentType },
              myTeam: {
                name: 'Your Team',
                members: [{ username: user.username, level: user.level, avatar: '👤' }],
              },
            });

            await tryCollab(io, {Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount, opponentType });
            return;
          }

          // ════════════════════════════════════
          // ── TEAM PATH ──
          // ════════════════════════════════════
          const team = await Team.findById(teamId).populate('members.user', 'level class username');

          if (!team) {
            await User.findByIdAndUpdate(userId, { $unset: { currentTeam: '' } });
            return socket.emit('error', { message: 'Your team no longer exists. Please try again.' });
          }

          const leaderMember = team.members.find(m => m.user._id.toString() === userId);
          if (!leaderMember || leaderMember.role !== 'leader') {
            return socket.emit('error', { message: 'Only team leader can start matchmaking' });
          }

          // ── Find online, available members ──
          const onlineMembers = [];
          for (const m of team.members) {
            const memberId = m.user._id.toString();
            const isOnline = await R.isUserOnline(memberId);
            if (!isOnline) { console.log(`⚠️ ${m.user.username} is offline — skipping`); continue; }
            const memberData = await R.getUserOnlineData(memberId);
            if (memberData?.isInGame === 'true') { console.log(`⚠️ ${m.user.username} is in a game — skipping`); continue; }
            const alreadyQueued = await R.getUserQueueEntry(memberId);
            if (alreadyQueued) { console.log(`⚠️ ${m.user.username} already in queue — skipping`); continue; }
            onlineMembers.push({ userId: memberId, username: m.user.username, level: m.user.level, class: m.user.class });
          }

          if (onlineMembers.length === 0) {
            return socket.emit('error', { message: 'No team members are available' });
          }

          // ── Calculate team averages ──
          const teamLevel = Math.round(
            onlineMembers.reduce((sum, m) => sum + (m.level || 1), 0) / onlineMembers.length
          );
          const avgClassNum = Math.round(
            onlineMembers.reduce((sum, m) => sum + classToNum(m.class), 0) / onlineMembers.length
          );
          const teamClass = avgClassNum >= 13 ? 'College' : String(avgClassNum);
          const teamName = team.name;
          const onlineTeamMembersStr = onlineMembers.map(m => m.userId).join(',');

          const parsedPlayerCount = parseInt(playerCount);
          const parsedQuestionCount = parseInt(questionCount);

          const myTeamData = {
            name: teamName,
            members: onlineMembers.map(m => ({ username: m.username, level: m.level, avatar: '👤' })),
          };

          const queueData = {Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount, opponentType };

          // ════════════════════════════════════════════════════════
          // ── TEAM COLLAB PATH — team is smaller than desired playerCount ──
          // e.g. 2-member team chose playerCount=4 → enter collab pool,
          // contribute 2 slots, wait for 2 more players to fill up
          // ════════════════════════════════════════════════════════
          if (onlineMembers.length < parsedPlayerCount) {
            console.log(`🤝 Team collab: ${teamName} has ${onlineMembers.length}/${parsedPlayerCount} slots — entering collab pool`);

            const collabEntry = {
              allUserIds: onlineMembers.map(m => m.userId),
              representativeUserId: userId, // leader is the representative
              players: onlineMembers.map(m => ({
                userId: m.userId,
                username: m.username,
                level: teamLevel,           // use team avg so canMatch is consistent
                playerClass: teamClass,
                avatar: '👤',
              })),
              Games,
              topic,
              questionCount: parsedQuestionCount,
              playerCount: parsedPlayerCount,
              opponentType,
              teamId,                       // preserve real teamId — used for queue:leave cleanup
              onlineTeamMembers: onlineTeamMembersStr,
              joinedAt: Date.now(),
            };

            await addToCollabPool(Games, topic, parsedQuestionCount, parsedPlayerCount, collabEntry);

            // Track collab meta for EVERY member so disconnect/leave can clean up
            for (const m of onlineMembers) {
              await redis.set(
                `collab:user:${m.userId}`,
                JSON.stringify({Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount, teamId }),
                'EX', 300
              );
            }

            // Notify all online members
            for (const m of onlineMembers) {
              const memberSocketData = await R.getUserOnlineData(m.userId);
              if (!memberSocketData?.socketId) continue;
              const memberSocket = io.sockets.sockets.get(memberSocketData.socketId);
              if (!memberSocket) continue;

              memberSocket.join(`collab:${Games}:${topic}:${parsedQuestionCount}:${parsedPlayerCount}`);
              memberSocket.emit('match:queued', {
                message: `Finding teammates... ${onlineMembers.length}/${parsedPlayerCount} joined`,
                isCollab: true,
                collabSlots: { filled: onlineMembers.length, total: parsedPlayerCount },
                queueData,
                myTeam: myTeamData,
              });
            }

            await tryCollab(io, { Games, topic, questionCount: parsedQuestionCount, playerCount: parsedPlayerCount, opponentType });
            return;
          }

          // ════════════════════════════════════════════════════════
          // ── TEAM FULL PATH — onlineMembers.length >= playerCount ──
          // Go straight to match queue (existing behaviour)
          // ════════════════════════════════════════════════════════

          // Cap members to playerCount if somehow more are online than requested
          const activeMembers = onlineMembers.slice(0, parsedPlayerCount);
          const activeMembersStr = activeMembers.map(m => m.userId).join(',');

          // Add each member to queue + notify
          for (const m of activeMembers) {
            await R.addToQueue(m.userId, {
              username: m.username,
              level: teamLevel,
              playerClass: teamClass,
              Games,
              topic,
              questionCount: parsedQuestionCount,
              playerCount: parsedPlayerCount,
              opponentType,
              teamId,
              onlineTeamMembers: activeMembersStr,
            });

            const memberSocketData = await R.getUserOnlineData(m.userId);
            if (!memberSocketData?.socketId) continue;
            const memberSocket = io.sockets.sockets.get(memberSocketData.socketId);
            if (!memberSocket) continue;

            memberSocket.join(`queue:${Games}:${topic}:${parsedQuestionCount}`);
            memberSocket.emit('match:queued', {
              message: 'Your team is searching for opponents!',
              queueData,
              myTeam: myTeamData,
            });
          }

          console.log(`👥 Team queue: ${teamName} — ${activeMembers.length} members`);
          await tryMatch(io, { Games, topic, playerCount: parsedPlayerCount, questionCount: parsedQuestionCount });

        } catch (err) {
          console.error('Join queue error:', err);
          socket.emit('error', { message: 'Failed to join queue' });
        }
      });

      // ═══════════════════════════════════════════════════════════════
      // LEAVE QUEUE
      // ═══════════════════════════════════════════════════════════════
      socket.on('queue:leave', async (data) => {
        try {
          if (!data || !data.userId) {
            return socket.emit('error', { message: 'userId required' });
          }

          const { userId, Games, topic, questionCount } = data;

          // ── Check collab pool first ──
          const collabMeta = await redis.get(`collab:user:${userId}`);
          if (collabMeta) {
            const { Games: cGames, topic: cTopic, questionCount: cQC, playerCount: cPC, teamId: cTeamId } = JSON.parse(collabMeta);

            if (cTeamId) {
              // ── Team in collab pool: only leader can pull everyone out ──
              const cTeam = await Team.findById(cTeamId).populate('members.user', '_id');
              const cMember = cTeam?.members.find(m => m.user._id.toString() === userId);
              if (!cMember || cMember.role !== 'leader') {
                return socket.emit('error', { message: 'Only the team leader can leave the queue' });
              }
              // Remove the whole team entry from the pool (matched by allUserIds)
              await removeUserFromCollabPool(cGames,cTopic, cQC, cPC, userId);
              // Clean up every member
              const memberIds = cTeam.members.map(m => m.user._id.toString());
              for (const memberId of memberIds) {
                await redis.del(`collab:user:${memberId}`);
                const memberData = await R.getUserOnlineData(memberId);
                if (!memberData?.socketId) continue;
                const memberSocket = io.sockets.sockets.get(memberData.socketId);
                if (!memberSocket) continue;
                memberSocket.leave(`collab:${cGames}:${cTopic}:${cQC}:${cPC}`);
                memberSocket.emit('queue:left', { message: 'Leader left the queue', redirect: '/game' });
              }
            } else {
              // ── Solo in collab pool ──
              await removeUserFromCollabPool(cGames,cTopic, cQC, cPC, userId);
              await redis.del(`collab:user:${userId}`);
              socket.leave(`collab:${cGames}:${cTopic}:${cQC}:${cPC}`);
              socket.emit('queue:left', { message: 'Left collab queue', redirect: '/game' });
            }

            console.log(`✅ User ${userId} left collab pool`);
            return;
          }

          // ── Regular queue ──
          const queueEntry = await R.getUserQueueEntry(userId);
          if (!queueEntry) {
            return socket.emit('queue:left', { message: 'Not in queue' });
          }

          if (queueEntry.teamId && queueEntry.teamId !== '') {
            const team = await Team.findById(queueEntry.teamId);
            if (!team) return socket.emit('error', { message: 'Team not found' });
            const member = team.members.find(m => m.user.toString() === userId);
            if (!member || member.role !== 'leader') {
              return socket.emit('error', { message: 'Only the team leader can leave the queue' });
            }
            const memberIds = queueEntry.onlineTeamMembers
              ? queueEntry.onlineTeamMembers.split(',')
              : [userId];
            for (const memberId of memberIds) {
              await R.removeFromQueue(memberId, Games ,topic, questionCount);
              const memberData = await R.getUserOnlineData(memberId);
              if (!memberData?.socketId) continue;
              const memberSocket = io.sockets.sockets.get(memberData.socketId);
              if (!memberSocket) continue;
              memberSocket.leave(`queue:${Games}:${topic}:${questionCount}`);
              memberSocket.emit('queue:left', { message: 'Leader left the queue', redirect: '/game' });
            }
          } else {
            await R.removeFromQueue(userId, Games, topic, questionCount);
            socket.leave(`queue:${Games}:${topic}:${questionCount}`);
            socket.emit('queue:left', { message: 'Left queue successfully', redirect: '/game' });
          }

          console.log(`✅ User ${userId} left queue`);

        } catch (err) {
          console.error('Queue leave error:', err);
          socket.emit('error', { message: 'Failed to leave queue' });
        }
      });

      // ─────────────────────────────────────────────
      // CHAT SOCKET EVENTS
      // ─────────────────────────────────────────────
      socket.on('chat:join', async ({ teamId, userId }) => {
        socket.join(`chat:${teamId}`);
        console.log(`💬 ${userId} joined chat:${teamId}`);
      });

      socket.on('chat:leave', ({ teamId }) => {
        socket.leave(`chat:${teamId}`);
      });

      socket.on('chat:sendMessage', async ({ teamId, type, content, replyTo }) => {
        try {
          const userId = socket.userId;
          if (!userId) return socket.emit('error', { message: 'Not authenticated' });
          if (!teamId || !type || !content?.trim()) {
            return socket.emit('error', { message: 'teamId, type and content required' });
          }
          const team = await Team.findById(teamId);
          if (!team) return socket.emit('error', { message: 'Team not found' });
          const isMember = team.members.some(m => m.user.toString() === userId);
          if (!isMember) return socket.emit('error', { message: 'Not a team member' });
          const message = await Message.create({
            sender: userId, team: teamId, type, content: content.trim(), replyTo: replyTo || null,
          });
          await message.populate('sender', 'username level profilePic');
          if (replyTo) await message.populate('replyTo', 'content sender type');
          io.to(`chat:${teamId}`).emit('chat:newMessage', { message });
          console.log(`💬 Message sent in team ${teamId} by ${userId}`);
        } catch (err) {
          console.error('Chat send error:', err);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('chat:typing', ({ teamId, userId, username }) => {
        socket.to(`chat:${teamId}`).emit('chat:userTyping', { userId, username });
      });

      socket.on('chat:stopTyping', ({ teamId, userId }) => {
        socket.to(`chat:${teamId}`).emit('chat:userStoppedTyping', { userId });
      });

      socket.on('chat:deleteMessage', async ({ teamId, messageId, deleteFor }) => {
        try {
          const userId = socket.userId;
          const message = await Message.findById(messageId);
          if (!message) return socket.emit('error', { message: 'Message not found' });
          if (deleteFor === 'everyone') {
            if (message.sender.toString() !== userId) {
              return socket.emit('error', { message: 'Only sender can delete for everyone' });
            }
            await Message.findByIdAndDelete(messageId);
            io.to(`chat:${teamId}`).emit('chat:messageDeleted', { messageId, deletedFor: 'everyone' });
          } else {
            if (!message.deletedFor.includes(userId)) {
              message.deletedFor.push(userId);
              await message.save();
            }
            socket.emit('chat:messageDeleted', { messageId, deletedFor: 'me' });
          }
        } catch (err) {
          socket.emit('error', { message: 'Failed to delete message' });
        }
      });

      socket.on('chat:editMessage', async ({ teamId, messageId, content }) => {
        try {
          const userId = socket.userId;
          const message = await Message.findById(messageId);
          if (!message) return socket.emit('error', { message: 'Message not found' });
          if (message.sender.toString() !== userId) {
            return socket.emit('error', { message: 'Can only edit your own messages' });
          }
          if (message.type !== 'text') {
            return socket.emit('error', { message: 'Can only edit text messages' });
          }
          message.content = content.trim();
          message.isEdited = true;
          message.editedAt = new Date();
          await message.save();
          io.to(`chat:${teamId}`).emit('chat:messageEdited', { message });
        } catch (err) {
          socket.emit('error', { message: 'Failed to edit message' });
        }
      });

      // ─────────────────────────────────────────────
      // GAME SOCKET EVENTS
      // ─────────────────────────────────────────────
      socket.on('game:join', async ({ gameId, userId }) => {
        socket.join(`game:${gameId}`);
        await R.registerPlayerSocket(gameId, userId, socket.id);
        await R.setUserInGame(userId, gameId);

        const session = await R.getGameSession(gameId);
        const activePlayers = await R.getActivePlayers(gameId);
        const teamAIds = session.teamAMembers.split(',').filter(Boolean);
        const teamBIds = session.teamBMembers.split(',').filter(Boolean);
        const totalExpected = teamAIds.length + teamBIds.length;

        io.to(`game:${gameId}`).emit('game:playerJoined', { userId, activePlayers, session });
        if (activePlayers.length >= totalExpected) {
  const alreadyStarted = await redis.get(`game:${gameId}:started`);
  
  if (!alreadyStarted) {
    // First player to complete — start the game
    const justStarted = await redis.set(`game:${gameId}:started`, '1', 'NX', 'EX', 3600);
    if (!justStarted) {
      // Lost the race — but still need to send state to this late joiner
      // Fall through to the re-emit block below
    } else {
      // We won the lock — start the game fresh
      if (session.Games === 'Truth and Dare') {
        await startTruthDareGame(io, gameId, session);
      } else if (session.Games === 'Pass the Story') {
        await startPassStory(io, gameId, session);
      } else {
        await startDiscussionGame(io, gameId, session);
      }
      return;
    }
  }

  // Game already started — this is a late joiner or reconnect.
  // Re-send the current game state directly to THIS socket only.
  if (session.Games === 'Pass the Story') {
    const turnOrderRaw = await redis.get(`pts:${gameId}:turnOrder`);
    const stripsRaw = await redis.get(`pts:${gameId}:strips`);
    const chitsLeft = await redis.get(`pts:${gameId}:chitsLeft`);
    const storyLinesRaw = await redis.get(`pts:${gameId}:storyLines`);

    if (turnOrderRaw && stripsRaw) {
      const storyLines = storyLinesRaw ? JSON.parse(storyLinesRaw) : [];
      socket.emit('game:ptsReady', {   // ← emit to THIS socket only, not io.to(room)
        turnOrder: JSON.parse(turnOrderRaw),
        strips: JSON.parse(stripsRaw),
        chitsLeft: parseInt(chitsLeft),
        storyStarter: storyLines[0] || '',
        storyLines,                    // ← also send full story so far
      });
    }
  } else if (session.Games === 'Truth and Dare') {
    const turnOrderRaw = await redis.get(`td:${gameId}:turnOrder`);
    const stripsRaw = await redis.get(`td:${gameId}:strips`);
    const chitsLeft = await redis.get(`td:${gameId}:chitsLeft`);

    if (turnOrderRaw && stripsRaw) {
      socket.emit('game:tdReady', {
        turnOrder: JSON.parse(turnOrderRaw),
        strips: JSON.parse(stripsRaw),
        chitsLeft: parseInt(chitsLeft),
      });
    }
  }
}

      });

      socket.on('game:chat:send', ({ gameId, userId, username, message }) => {
        io.to(`game:${gameId}`).emit('game:chat:message', {
          userId, username, message, timestamp: Date.now()
        });
      });

      socket.on('game:voteNextQuestion', async ({ gameId, userId }) => {
        try {
          const session = await R.getGameSession(gameId);
          if (session.status !== 'discussion') return;
          await R.addNextQuestionVote(gameId, userId);
          const votes = await R.getNextQuestionVotes(gameId);
          const activePlayers = await R.getActivePlayers(gameId);
          io.to(`game:${gameId}`).emit('game:nextQuestionVote', {
            votes: votes.length, required: activePlayers.length, votedUserIds: votes,
          });
          if (votes.length >= activePlayers.length) {
            const currentQ = parseInt(session.currentQuestionNumber || 1);
            const nextQ = currentQ + 1;
            await R.clearNextQuestionVotes(gameId);
            if (nextQ > parseInt(session.totalQuestions)) {
              await endDiscussionGame(io, gameId);
              return;
            }
            let question = await R.getDiscussionQuestion(gameId, nextQ);
            if (!question) {
              // pre-fetch lost the race — generate now (blocking, but rare)
              console.warn(`⚠️ Pre-fetch missed Q${nextQ} — generating on demand`);
              question = await generateDiscussionQuestion(session.topic, nextQ);
              await R.setDiscussionQuestion(gameId, nextQ, question);
            }
            await R.setCurrentQuestionNumber(gameId, nextQ);
            io.to(`game:${gameId}`).emit('game:discussionQuestion', {
              question, questionNumber: nextQ, totalQuestions: parseInt(session.totalQuestions),
            });
            generateDiscussionQuestion(session.topic, nextQ + 1)
              .then(q => R.setDiscussionQuestion(gameId, nextQ + 1, q))
              .catch(err => console.error(`Pre-fetch Q${nextQ + 1} error:`, err.message));
          }
        } catch (err) {
          console.error('voteNextQuestion error:', err);
          socket.emit('error', { message: 'Failed to process vote' });
        }
      });
     
      socket.on('game:ratePlayer', async ({ gameId, raterUserId, ratedUserId, stars, questionNumber, question }) => {
        try {
          if (!gameId || !raterUserId || !ratedUserId || !stars || !questionNumber) return;
          if (stars < 1 || stars > 5) return;
          if (raterUserId === ratedUserId) return;
          const ratingKey = `game:${gameId}:ratings`;
          const ratingEntry = JSON.stringify({ raterUserId, ratedUserId, stars, questionNumber, question: question || '' });
          await redis.rpush(ratingKey, ratingEntry);
          await redis.expire(ratingKey, 7200);
          console.log(`⭐ ${raterUserId} rated ${ratedUserId} ${stars}★ for Q${questionNumber}`);
        } catch (err) {
          console.error('game:ratePlayer error:', err.message);
        }
      });
      socket.on('game:voteSpin', async ({ gameId, userId }) => {
  try {
    await R.addSpinVote(gameId, userId);  // same pattern as addNextQuestionVote
    const votes = await R.getSpinVotes(gameId);
    const activePlayers = await R.getActivePlayers(gameId);

    io.to(`game:${gameId}`).emit('game:spinVoteUpdate', {
      votes: votes.length,
      required: activePlayers.length,
    });

    if (votes.length >= activePlayers.length) {
      await R.clearSpinVotes(gameId);

      // Use correct Redis prefix — PTS uses pts: prefix, TD uses td:
      const session = await R.getGameSession(gameId);
      const keyPrefix = session?.Games === 'Pass the Story' ? 'pts' : 'td';

      const stripsRaw = await redis.get(`${keyPrefix}:${gameId}:strips`);
      const strips = JSON.parse(stripsRaw);
      if (!strips) {
        console.error(`No strips found for game ${gameId} (prefix: ${keyPrefix})`);
        return;
      }
      const landedIndex = Math.floor(Math.random() * strips.length);
      const landedTurnNumber = strips[landedIndex];

      const turnOrderRaw = await redis.get(`${keyPrefix}:${gameId}:turnOrder`);
      const turnOrder = JSON.parse(turnOrderRaw);
      const landed = turnOrder.find(t => t.turnNumber === landedTurnNumber);

      io.to(`game:${gameId}`).emit('game:wheelResult', {
        landedIndex,
        landedTurnNumber,
        landedUserId: landed.userId,
      });
    }
  } catch (err) {
    console.error('game:voteSpin error:', err);
    socket.emit('error', { message: 'Failed to process spin vote' });
  }
});
socket.on('game:chooseTruthOrDare', async ({ gameId, userId, choice }) => {
  try {
    // Only the landed player can call this — server should verify
    const usedTruths = JSON.parse(await redis.get(`td:${gameId}:usedTruths`) || '[]');
    const usedDares = JSON.parse(await redis.get(`td:${gameId}:usedDares`) || '[]');

    let prompt, usedIndex;

    if (choice === 'truth') {
      const available = TRUTH_QUESTIONS
        .map((q, i) => ({ q, i }))
        .filter(({ i }) => !usedTruths.includes(i));
      
      if (available.length === 0) {
        // All used — reset
        await redis.set(`td:${gameId}:usedTruths`, JSON.stringify([]), 'EX', 7200);
        usedIndex = Math.floor(Math.random() * TRUTH_QUESTIONS.length);
      } else {
        const pick = available[Math.floor(Math.random() * available.length)];
        usedIndex = pick.i;
      }
      prompt = TRUTH_QUESTIONS[usedIndex];
      usedTruths.push(usedIndex);
      await redis.set(`td:${gameId}:usedTruths`, JSON.stringify(usedTruths), 'EX', 7200);

    } else {
      const available = DARE_TASKS
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => !usedDares.includes(i));

      if (available.length === 0) {
        await redis.set(`td:${gameId}:usedDares`, JSON.stringify([]), 'EX', 7200);
        usedIndex = Math.floor(Math.random() * DARE_TASKS.length);
      } else {
        const pick = available[Math.floor(Math.random() * available.length)];
        usedIndex = pick.i;
      }
      prompt = DARE_TASKS[usedIndex];
      usedDares.push(usedIndex);
      await redis.set(`td:${gameId}:usedDares`, JSON.stringify(usedDares), 'EX', 7200);
    }

    io.to(`game:${gameId}`).emit('game:tdPrompt', {
      userId,
      choice,
      prompt,
    });

  } catch (err) {
    console.error('game:chooseTruthOrDare error:', err);
  }
});

// ── PASS THE STORY: player submits their story line ──
socket.on('game:submitStoryLine', async ({ gameId, userId, line }) => {
  try {
    if (!gameId || !userId || !line?.trim()) return;

    // Append this line to the running story in Redis
    const raw = await redis.get(`pts:${gameId}:storyLines`);
    const storyLines = raw ? JSON.parse(raw) : [];
    storyLines.push(line.trim());
    await redis.set(`pts:${gameId}:storyLines`, JSON.stringify(storyLines), 'EX', 7200);

    // Broadcast the updated story to all players
    io.to(`game:${gameId}`).emit('game:ptsNewLine', {
      userId,
      line: line.trim(),
      storyLines,
    });

  } catch (err) {
    console.error('game:submitStoryLine error:', err);
  }
});

// ── PASS THE STORY: landed player signals their turn is done ──
socket.on('game:ptsDone', async ({ gameId }) => {
  try {
    const chitsLeft = parseInt(await redis.get(`pts:${gameId}:chitsLeft`)) - 1;
    await redis.set(`pts:${gameId}:chitsLeft`, chitsLeft, 'EX', 7200);

    if (chitsLeft <= 0) {
      const storyRaw = await redis.get(`pts:${gameId}:storyLines`);
      const storyLines = storyRaw ? JSON.parse(storyRaw) : [];

      await R.deleteGameSession(gameId);
      await redis.del(`game:${gameId}:started`);
      await redis.del(`pts:${gameId}:turnOrder`);
      await redis.del(`pts:${gameId}:chitsLeft`);
      await redis.del(`pts:${gameId}:strips`);
      await redis.del(`pts:${gameId}:storyLines`);

      io.to(`game:${gameId}`).emit('game:ended', {
        result: 'passstory_complete',
        message: 'The story is complete!',
        storyLines,
      });
    } else {
      io.to(`game:${gameId}`).emit('game:readyToSpin', { chitsLeft });
    }
  } catch (err) {
    console.error('game:ptsDone error:', err);
  }
});

socket.on('game:tdDone', async ({ gameId }) => {
  try {
    const chitsLeft = parseInt(await redis.get(`td:${gameId}:chitsLeft`)) - 1;
    await redis.set(`td:${gameId}:chitsLeft`, chitsLeft, 'EX', 7200);

    if (chitsLeft <= 0) {
      await endTruthDareGame(io, gameId);
    } else {
      io.to(`game:${gameId}`).emit('game:readyToSpin', { chitsLeft });
    }
  } catch (err) {
    console.error('game:tdDone error:', err);
  }
});
      socket.on('game:leave', async ({ gameId, userId }) => {
        try {
          await R.removeActivePlayer(gameId, userId);
          await R.setUserOffGame(userId);
          socket.leave(`game:${gameId}`);
          const remainingPlayers = await R.getActivePlayers(gameId);
          io.to(`game:${gameId}`).emit('game:playerLeft', { userId, remainingPlayers });
          if (remainingPlayers.length === 0) {
            const session = await R.getGameSession(gameId);
            if (session) await saveDiscussionHistory(gameId, session);
            await R.deleteGameSession(gameId);
            await redis.del(`game:${gameId}:started`);
            console.log(`🗑️ Game ${gameId} ended — all players left`);
          }
        } catch (err) {
          console.error('game:leave error:', err);
        }
      });

      socket.on('disconnect', async () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
        const userId = socket.userId;
        if (!userId) return;

        // ── Clean up collab pool ──
        const collabMeta = await redis.get(`collab:user:${userId}`);
        if (collabMeta) {
          const { Games: dGames,topic: dTopic, questionCount: dQC, playerCount: dPC, teamId: dTeamId } = JSON.parse(collabMeta);
          // Remove this user's entire entry from the pool (handles solo + team)
          await removeUserFromCollabPool(dGames, dTopic, dQC, dPC, userId);
          if (dTeamId) {
            // Team disconnect — clean up all members' keys and notify them
            const dTeam = await Team.findById(dTeamId).populate('members.user', '_id').catch(() => null);
            const dMemberIds = dTeam?.members.map(m => m.user._id.toString()) || [userId];
            for (const mid of dMemberIds) {
              await redis.del(`collab:user:${mid}`);
              const mData = await R.getUserOnlineData(mid);
              if (!mData?.socketId || mid === userId) continue; // skip disconnected user
              const mSocket = io.sockets.sockets.get(mData.socketId);
              if (!mSocket) continue;
              mSocket.leave(`collab:${dGames}:${dTopic}:${dQC}:${dPC}`);
              mSocket.emit('queue:left', { message: 'A teammate disconnected — queue cancelled', redirect: '/game' });
            }
          } else {
            await redis.del(`collab:user:${userId}`);
          }
          console.log(`🧹 Removed ${userId} from collab pool on disconnect`);
        }

        // ── Clean up regular queue ──
        const queueEntry = await R.getUserQueueEntry(userId);
        if (queueEntry) {
          if (queueEntry.teamId) {
            const members = queueEntry.onlineTeamMembers
              ? queueEntry.onlineTeamMembers.split(',')
              : [];
            for (const memberId of members) {
              await R.removeFromQueue(memberId, queueEntry.Games, queueEntry.topic, queueEntry.questionCount);
            }
            console.log(`🧹 Removed team ${queueEntry.teamId} from queue on disconnect`);
          } else {
            await R.removeFromQueue(userId,queueEntry.Games, queueEntry.topic, queueEntry.questionCount);
          }
        }

        await R.setUserOffline(userId);
        console.log(`👤 ${userId} marked offline`);
      });

      socket.on('webrtc:offer', ({ offer, targetUserId, fromUserId, gameId }) => {
        io.to(`user:${targetUserId}`).emit('webrtc:offer', { offer, fromUserId });
      });
      socket.on('webrtc:videoToggle', ({ gameId, userId, videoEnabled }) => {
        socket.to(`game:${gameId}`).emit('webrtc:videoToggle', { userId, videoEnabled });
      });
      socket.on('webrtc:answer', ({ answer, targetUserId, fromUserId }) => {
        io.to(`user:${targetUserId}`).emit('webrtc:answer', { answer, fromUserId });
      });
      socket.on('webrtc:ice', ({ candidate, targetUserId, fromUserId, gameId }) => {
  // Serialize the full candidate object explicitly
  io.to(`user:${targetUserId}`).emit('webrtc:ice', { 
    candidate: {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
    }, 
    fromUserId 
  });
});
    });
};

// ═══════════════════════════════════════════════════════════════
// TRY COLLAB — Assemble a temp team from solo/team queue entries
// ═══════════════════════════════════════════════════════════════
//
// Called whenever a new player joins with playerCount > 1.
// 
// Logic:
//   1. Pull the collab staging pool for this {topic, questionCount, playerCount}
//   2. Try to fill a group of exactly `playerCount` players using compatible entries
//      Compatible = level diff ≤ 5, classDiff ≤ 2 (same canMatch rules as tryMatch)
//   3. Permutations allowed:
//      - N solo entries summing to playerCount
//      - mix of solos + pre-formed team entries (e.g. a 2-man team fills 2 slots)
//   4. When a full group is assembled:
//      a. Remove their entries from the collab pool + their collab:user: keys
//      b. Emit live slot-fill updates throughout assembly
//      c. Add them to the regular match queue as a single unified entry
//      d. Call tryMatch to find an opponent
//
// ═══════════════════════════════════════════════════════════════
async function tryCollab(io, { Games, topic, questionCount, playerCount, opponentType }) {
  try {
    console.log(`🤝 tryCollab: ${Games}:${topic}, ${questionCount}Q, team of ${playerCount}`);

    const pool = await getCollabPool(Games, topic, questionCount, playerCount);

    if (pool.length === 0) {
      console.log('Collab pool empty');
      return;
    }

    // ── Helper: level compatibility between two collab entries ──
    const classToNum = (cls) => {
      if (!cls) return 9;
      if (cls === 'Other' || cls === 'College') return 13;
      const n = parseInt(cls);
      return isNaN(n) ? 9 : n;
    };

    // Compare two individual player objects (not entries)
    const playersCompatible = (p1, p2) => {
      const levelDiff = Math.abs(parseInt(p1.level || 1) - parseInt(p2.level || 1));
      const classDiff = Math.abs(classToNum(p1.playerClass) - classToNum(p2.playerClass));
      return levelDiff <= 5 && classDiff <= 2;
    };

    // All players in entry A compatible with all players in entry B?
    const entriesCompatible = (e1, e2) => {
      for (const p1 of e1.players) {
        for (const p2 of e2.players) {
          if (!playersCompatible(p1, p2)) return false;
        }
      }
      return true;
    };

    // ── Greedy slot-fill: find a combination of entries that exactly fills playerCount ──
    // We use a recursive approach capped at reasonable depth (pool is small by design)
    const findGroup = (remaining, startIdx, currentGroup, slotsLeft) => {
      if (slotsLeft === 0) return currentGroup; // ✅ exact fill

      for (let i = startIdx; i < remaining.length; i++) {
        const entry = remaining[i];
        const entrySize = entry.allUserIds.length;

        if (entrySize > slotsLeft) continue; // would overflow

        // Must be compatible with everything already in the group
        const compatible = currentGroup.every(g => entriesCompatible(g, entry));
        if (!compatible) continue;

        const result = findGroup(
          remaining,
          i + 1,
          [...currentGroup, entry],
          slotsLeft - entrySize
        );
        if (result) return result; // found a valid group
      }

      return null; // no valid combination from this path
    };

    const group = findGroup(pool, 0, [], playerCount);

    if (!group) {
      // Count total slots currently in pool and emit progress to everyone waiting
      const totalFilled = pool.reduce((sum, e) => sum + e.allUserIds.length, 0);
      console.log(`⏳ Collab pool has ${totalFilled}/${playerCount} players — waiting for more`);

      // Notify all waiting players of current slot progress
      // We broadcast to the collab socket room (players joined it on entry)
      // using global io — we don't have a socket ref here, so use room broadcast
      io.to(`collab:${Games}:${topic}:${questionCount}:${playerCount}`).emit('match:collabUpdate', {
        filled: totalFilled,
        total: playerCount,
        message: `Finding teammates... ${totalFilled}/${playerCount} joined`,
      });
      return;
    }

    // ── Full group assembled! ──
    console.log(`✅ Collab group of ${playerCount} assembled for ${topic}!`);

    const groupUserIds = group.flatMap(e => e.allUserIds);
    const groupPlayers = group.flatMap(e => e.players);

    // ── Remove assembled entries from pool ──
    const assembledIds = new Set(groupUserIds);
    const remainingPool = pool.filter(e => !e.allUserIds.some(id => assembledIds.has(id)));
    await setCollabPool(Games,topic, questionCount, playerCount, remainingPool);

    // ── Clean up collab:user: keys for each assembled player ──
    for (const uid of groupUserIds) {
      await redis.del(`collab:user:${uid}`);
    }

    // ── Calculate unified team averages ──
    const avgLevel = Math.round(
      groupPlayers.reduce((sum, p) => sum + parseInt(p.level || 1), 0) / groupPlayers.length
    );
    const avgClassNum = Math.round(
      groupPlayers.reduce((sum, p) => sum + classToNum(p.playerClass), 0) / groupPlayers.length
    );
    const unifiedClass = avgClassNum >= 13 ? 'College' : String(avgClassNum);

    // ── Build a single unified queue entry representing the whole temp team ──
    // We use a synthetic tempTeamId so tryMatch treats them as one team
    const tempTeamId = `tempcollab:${uuid()}`;
    const onlineTeamMembersStr = groupUserIds.join(',');

    // The representative userId is the first entry's representative
    // (used for queue removal — removeFromQueue is keyed by userId)
    const representativeUserId = group[0].representativeUserId;

    const unifiedQueueEntry = {
      username: `TempTeam(${groupPlayers.map(p => p.username).join('+')})`,
      level: avgLevel,
      playerClass: unifiedClass,
      Games,
      topic,
      questionCount,
      playerCount,
      opponentType,
      teamId: tempTeamId,          // non-null → tryMatch treats as a team entry
      onlineTeamMembers: onlineTeamMembersStr,
      isCollabTeam: true,          // flag for diagnostics / frontend awareness
    };

    // ── Add all players to regular queue under the unified entry ──
    // Each member gets their own queue key (so removeFromQueue works per-player)
    // but they all carry the same teamId so tryMatch deduplicates them
    for (const uid of groupUserIds) {
      await R.addToQueue(uid, { ...unifiedQueueEntry });
    }

    // Move each player from collab room to the regular queue room
    for (const uid of groupUserIds) {
      const memberData = await R.getUserOnlineData(uid);
      if (!memberData?.socketId) continue;
      const memberSocket = io.sockets.sockets.get(memberData.socketId);
      if (!memberSocket) continue;

      memberSocket.leave(`collab:${Games}:${topic}:${questionCount}:${playerCount}`);
      memberSocket.join(`queue:${Games}:${topic}:${questionCount}`);

      // Notify the player their team is fully assembled and now searching for opponent
      memberSocket.emit('match:collabTeamReady', {
        message: `Team of ${playerCount} assembled! Searching for opponent...`,
        myTeam: {
          name: `Temp Team`,
          members: groupPlayers.map(p => ({
            username: p.username,
            level: p.level,
            avatar: p.avatar || '👤',
          })),
        },
        queueData: { Games,topic, questionCount, playerCount, opponentType },
      });
    }

    console.log(`🚀 Collab temp team entered match queue: ${groupUserIds.join(', ')}`);

    // ── Now try to find an opponent for this assembled team ──
    await tryMatch(io, { Games,topic, playerCount, questionCount });

  } catch (err) {
    console.error('❌ tryCollab error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// TRY MATCH
// ═══════════════════════════════════════════════════════════════
async function tryMatch(io, { Games, topic, playerCount, questionCount }) {
  try {
    console.log(`🔍 Trying to match for ${Games},${topic}, ${questionCount} questions`);

    const allEntries = await R.getQueueEntries(Games,topic, questionCount);

    if (allEntries.length < 2) {
      console.log('Not enough players in queue');
      return;
    }

    console.log(`Found ${allEntries.length} entries in queue`);

    // ── Helper: level and class compatibility ──
    const classToNum = (cls) => {
      if (!cls) return 9;
      if (cls === 'Other' || cls === 'College') return 13;
      const num = parseInt(cls);
      return isNaN(num) ? 9 : num;
    };

    const canMatch = (p1, p2) => {
      const levelDiff = Math.abs(parseInt(p1.level || 1) - parseInt(p2.level || 1));
      const classDiff = Math.abs(classToNum(p1.playerClass) - classToNum(p2.playerClass));
      const compatible = levelDiff <= 5 && classDiff <= 2;
      if (!compatible) {
        console.log(`❌ Level/class mismatch: ${p1.username}(${p1.level}) vs ${p2.username}(${p2.level})`);
      }
      return compatible;
    };

    // ── Helper: how many players does this entry represent ──
    const getPlayerCount = (entry) => {
      if (!entry.teamId || entry.teamId === '') return 1;
      if (entry.onlineTeamMembers) {
        return entry.onlineTeamMembers.split(',').filter(Boolean).length;
      }
      return 1;
    };

    const opponentTypeToCount = { 'solo': 1, 'duo': 2, 'trio': 3, 'squad': 4 };

    // ── Deduplicate entries by teamId (team members each have own queue entry) ──
    const seenTeams = new Set();
    const uniqueEntries = [];
    for (const queueEntry of allEntries) {
      if (queueEntry.teamId && queueEntry.teamId !== '') {
        if (seenTeams.has(queueEntry.teamId)) continue;
        seenTeams.add(queueEntry.teamId);
      }
      uniqueEntries.push(queueEntry);
    }

    console.log(`Unique entries after dedup: ${uniqueEntries.length}`);

    if (uniqueEntries.length < 2) {
      console.log('Not enough unique entries after dedup');
      return;
    }

    // ── Match pairs ──
    for (let i = 0; i < uniqueEntries.length - 1; i++) {
      for (let j = i + 1; j < uniqueEntries.length; j++) {
        const e1 = uniqueEntries[i];
        const e2 = uniqueEntries[j];

        if (e1.teamId && e1.teamId === e2.teamId) continue;

        // ── FIX: Skip if either player is already in a game ──
        const e1Online = await R.getUserOnlineData(e1.userId);
        const e2Online = await R.getUserOnlineData(e2.userId);
        if (e1Online?.isInGame === 'true') {
          console.log(`⚠️ Skipping ${e1.username} — already in a game`);
          continue;
        }
        if (e2Online?.isInGame === 'true') {
          console.log(`⚠️ Skipping ${e2.username} — already in a game`);
          continue;
        }
        const e1Claiming = await redis.get(`claiming:${e1.userId}`);
        const e2Claiming = await redis.get(`claiming:${e2.userId}`);
        if (e1Claiming || e2Claiming) continue;
        if (!canMatch(e1, e2)) continue;

        const e1Count = getPlayerCount(e1);
        const e2Count = getPlayerCount(e2);
        const e1Wants = opponentTypeToCount[e1.opponentType];
        const e2Wants = opponentTypeToCount[e2.opponentType];

        console.log(`Checking: ${e1.username}(has ${e1Count}, wants ${e1Wants}) vs ${e2.username}(has ${e2Count}, wants ${e2Wants})`);

        const e1Satisfied = !e1Wants || e2Count === e1Wants;
        const e2Satisfied = !e2Wants || e1Count === e2Wants;

        if (e1Satisfied && e2Satisfied) {
          const claimKey1 = `claiming:${e1.userId}`;
          const claimKey2 = `claiming:${e2.userId}`;
          
          // NX = only set if not exists — if either fails, someone else grabbed them
          const claimed1 = await redis.set(claimKey1, '1', 'NX', 'PX', 10000);
          const claimed2 = await redis.set(claimKey2, '1', 'NX', 'PX', 10000);
          
          if (!claimed1 || !claimed2) {
            // One of them was already claimed by a concurrent tryMatch — release and skip
            if (claimed1) await redis.del(claimKey1);
            if (claimed2) await redis.del(claimKey2);
            console.log(`⚠️ Claim failed for ${e1.username} or ${e2.username} — skipping`);
            continue;
          }
          console.log(`✅ MATCH: ${e1.username} plays for ${e1.Games}(has ${e1Count}, wants ${e1.opponentType}) vs ${e2.username}(has ${e2Count}, wants ${e2.opponentType})`);
          await createMatch(io, e1, e2);
          return;
        }
      }
    }

    console.log('No compatible matches found in this iteration');

  } catch (err) {
    console.error('❌ tryMatch error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE MATCH FROM TWO ENTRIES
// ═══════════════════════════════════════════════════════════════
async function createMatch(io, entry1, entry2) {
  const gameId = uuid();

  console.log('🎮 Creating match:', gameId);
  console.log('Entry1:', entry1);
  console.log('Entry2:', entry2);

  const getMembers = async (entry) => {
    if (!entry.teamId || entry.teamId === '') {
      return [{ userId: entry.userId, username: entry.username, level: entry.level, avatar: '👤' }];
    }
    const memberIds = entry.onlineTeamMembers.split(',').filter(Boolean);
    return await Promise.all(
      memberIds.map(async (userId) => {
        const userData = await R.getUserOnlineData(userId);
        return { userId, username: userData?.username || 'Unknown', level: userData?.level || 1, avatar: '👤' };
      })
    );
  };

  const teamAMembers = await getMembers(entry1);
  const teamBMembers = await getMembers(entry2);

  console.log('TeamA members:', teamAMembers);
  console.log('TeamB members:', teamBMembers);

  const teamAUserIds = teamAMembers.map(m => m.userId);
  const teamBUserIds = teamBMembers.map(m => m.userId);
  const allUserIds = [...teamAUserIds, ...teamBUserIds];

  // ── FIX: Remove ALL players from queue FIRST to prevent race condition ──
  for (const userId of allUserIds) {
    await R.removeFromQueue(userId, entry1.Games,entry1.topic, entry1.questionCount);
  }

  // ── Mark all players as in-game immediately ──
  for (const userId of allUserIds) {
    await R.setUserInGame(userId, gameId);
  }

  const firstTeam = Math.random() < 0.5 ? 'teamA' : 'teamB';
  const teamATurnOrder = shuffle(teamAUserIds);
  const teamBTurnOrder = shuffle(teamBUserIds);

  await R.createGameSession({
    gameId,
    Games: entry1.Games,
    topic: entry1.topic,
    totalQuestions: entry1.questionCount,
    teamAMembers: teamAUserIds,
    teamBMembers: teamBUserIds,
    currentTeam: firstTeam,
    questionsAsked: 0,
    status: 'greet',
  });

  allUserIds.forEach(userId => {
    const isTeamA = teamAUserIds.includes(userId);
    io.to(`user:${userId}`).emit('match:found', {
      gameId,
      Games: entry1.Games,
      topic: entry1.topic,
      totalQuestions: entry1.questionCount,
      firstTeam,
      myTeamKey: isTeamA ? 'teamA' : 'teamB',
      myMembers: isTeamA ? teamAMembers : teamBMembers,
      opponentMembers: isTeamA ? teamBMembers : teamAMembers,
      // Let frontend know if this side was a collab-assembled team
      isCollabTeam: isTeamA ? (entry1.isCollabTeam || false) : (entry2.isCollabTeam || false),
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// GAME LIFECYCLE
// ═══════════════════════════════════════════════════════════════
async function startTruthDareGame(io, gameId, session) {
  const teamAIds = session.teamAMembers.split(',').filter(Boolean);
  const teamBIds = session.teamBMembers.split(',').filter(Boolean);
  const allPlayerIds = [...teamAIds, ...teamBIds];

  // Randomly assign turn numbers 1-N to each player
  const shuffled = shuffle(allPlayerIds);
  const turnOrder = shuffled.map((userId, i) => ({ userId, turnNumber: i + 1 }));

  // Store in Redis
  await redis.set(`td:${gameId}:turnOrder`, JSON.stringify(turnOrder), 'EX', 7200);
  await redis.set(`td:${gameId}:chitsLeft`, session.totalQuestions, 'EX', 7200);
  await redis.set(`td:${gameId}:usedTruths`, JSON.stringify([]), 'EX', 7200);
  await redis.set(`td:${gameId}:usedDares`, JSON.stringify([]), 'EX', 7200);

  // Build 8 wheel strips
  // First N strips = actual turn numbers 1-N
  // Remaining (8-N) strips = random picks from 1-N (so every number appears at least once guaranteed since actual ones are already there)
   const totalStrips = 8;
const N = allPlayerIds.length; // real player count

// Base distribution — divide 8 strips as evenly as possible
const basePerPlayer = Math.floor(totalStrips / N); // e.g. 2 players → 4 each, 3 players → 2 each
const remainder = totalStrips % N;                 // e.g. 3 players → 2 leftover strips

const strips = [];

// Fill base slots — every player gets basePerPlayer strips
for (let i = 0; i < N; i++) {
  for (let j = 0; j < basePerPlayer; j++) {
    strips.push(i + 1); // turnNumber is 1-indexed
  }
}

// Fill remainder strips randomly (any turn number 1-N)
for (let i = 0; i < remainder; i++) {
  strips.push(Math.ceil(Math.random() * N));
}

// Shuffle the strips so same numbers aren't bunched together on the wheel
const shuffledStrips = shuffle(strips);

// Store strips in Redis too (needed by game:voteSpin)
await redis.set(`td:${gameId}:strips`, JSON.stringify(shuffledStrips), 'EX', 7200);

  await R.setGameStatus(gameId, 'truthdare');

  io.to(`game:${gameId}`).emit('game:tdReady', {
    turnOrder,   // [{userId, turnNumber}]
    strips: shuffledStrips,      // 8 numbers for the wheel
    chitsLeft: parseInt(session.totalQuestions),
  });
}

async function startPassStory(io, gameId, session) {
  const teamAIds = session.teamAMembers.split(',').filter(Boolean);
  const teamBIds = session.teamBMembers.split(',').filter(Boolean);
  const allPlayerIds = [...teamAIds, ...teamBIds];

  // Randomly assign turn numbers 1-N to each player
  const shuffled = shuffle(allPlayerIds);
  const turnOrder = shuffled.map((userId, i) => ({ userId, turnNumber: i + 1 }));

  // Store in Redis
  await redis.set(`pts:${gameId}:turnOrder`, JSON.stringify(turnOrder), 'EX', 7200);    //pts -> pass the story
  await redis.set(`pts:${gameId}:chitsLeft`, session.totalQuestions, 'EX', 7200);
  // Build 8 wheel strips
  // First N strips = actual turn numbers 1-N
  // Remaining (8-N) strips = random picks from 1-N (so every number appears at least once guaranteed since actual ones are already there)
   const totalStrips = 8;
const N = allPlayerIds.length; // real player count

// Base distribution — divide 8 strips as evenly as possible
const basePerPlayer = Math.floor(totalStrips / N); // e.g. 2 players → 4 each, 3 players → 2 each
const remainder = totalStrips % N;                 // e.g. 3 players → 2 leftover strips

const strips = [];

// Fill base slots — every player gets basePerPlayer strips
for (let i = 0; i < N; i++) {
  for (let j = 0; j < basePerPlayer; j++) {
    strips.push(i + 1); // turnNumber is 1-indexed
  }
}

// Fill remainder strips randomly (any turn number 1-N)
for (let i = 0; i < remainder; i++) {
  strips.push(Math.ceil(Math.random() * N));
}

// Shuffle the strips so same numbers aren't bunched together on the wheel
const shuffledStrips = shuffle(strips);

// Store strips in Redis too (needed by game:voteSpin)
await redis.set(`pts:${gameId}:strips`, JSON.stringify(shuffledStrips), 'EX', 7200);

  await R.setGameStatus(gameId, 'passStory');

  // Pick the story starter from the right genre array
  const genreMap = {
    Horror: Horror,
    Comedy: Comedy,
    'Sci-Fi': SCI_FI,
    'Rom-Com': ROM_COM,
    'Family Drama': Family_Drama,
    Action: Action,
    Thriller: Thriller,
  };
  const genreStarters = genreMap[session.topic] || Horror;
  const storyStarter = genreStarters[Math.floor(Math.random() * genreStarters.length)];

  // Store story lines in Redis as a JSON array — starter is line 0
  await redis.set(`pts:${gameId}:storyLines`, JSON.stringify([storyStarter]), 'EX', 7200);

  io.to(`game:${gameId}`).emit('game:ptsReady', {
    turnOrder,
    strips: shuffledStrips,
    chitsLeft: parseInt(session.totalQuestions),
    storyStarter,          // frontend displays this as the opening line
    isPassStory: true,     // frontend uses this to render PTS UI instead of TD UI
  });
}


async function startDiscussionGame(io, gameId, session) {
  await R.setGameStatus(gameId, 'greet');
  io.to(`game:${gameId}`).emit('game:greetPhase', { duration: 30, gameId });

  generateDiscussionQuestion(session.topic, 1)
    .then(question => R.setDiscussionQuestion(gameId, 1, question))
    .then(() => console.log(`✅ Q1 pre-fetched for game ${gameId}`))
    .catch(err => console.error('Pre-fetch Q1 error:', err.message));

  setTimeout(async () => {
    try {
      const question = await R.getDiscussionQuestion(gameId, 1);
      const finalQuestion = question || `What are your thoughts on ${session.topic}?`;
      await R.setGameStatus(gameId, 'discussion');
      await R.setCurrentQuestionNumber(gameId, 1);
      io.to(`game:${gameId}`).emit('game:discussionQuestion', {
        question: finalQuestion,
        questionNumber: 1,
        totalQuestions: parseInt(session.totalQuestions),
      });
      generateDiscussionQuestion(session.topic, 2)
        .then(q => R.setDiscussionQuestion(gameId, 2, q))
        .catch(err => console.error('Pre-fetch Q2 error:', err.message));
    } catch (err) {
      console.error('Discussion start error:', err);
    }
  }, 30000);
}

async function endDiscussionGame(io, gameId) {
  try {
    const session = await R.getGameSession(gameId);
    if (session) await saveDiscussionHistory(gameId, session);
    await R.deleteGameSession(gameId);
    await redis.del(`game:${gameId}:started`);
    io.to(`game:${gameId}`).emit('game:ended', {
      result: 'discussion_complete',
      message: 'Discussion session ended!'
    });
    console.log(`🏁 Discussion game ${gameId} ended`);
  } catch (err) {
    console.error('endDiscussionGame error:', err);
  }
}
async function endTruthDareGame(io, gameId) {
  try {
    const session = await R.getGameSession(gameId);
    await R.deleteGameSession(gameId);
    await redis.del(`game:${gameId}:started`);
    await redis.del(`td:${gameId}:turnOrder`);
    await redis.del(`td:${gameId}:strips`);
    await redis.del(`td:${gameId}:chitsLeft`);
    await redis.del(`td:${gameId}:usedTruths`);
    await redis.del(`td:${gameId}:usedDares`);
    io.to(`game:${gameId}`).emit('game:ended', {
      result: 'truthdare_complete',
      message: 'Truth & Dare session ended!'
    });
    console.log(`🏁 Truth & Dare game ${gameId} ended`);
  } catch (err) {
    console.error('endTruthDareGame error:', err);
  }
}
// ── XP thresholds based on average rating received ──
function xpFromRating(avgStars) {
  if (avgStars >= 4.5) return 50;  // exceptional
  if (avgStars >= 3.5) return 30;  // good
  if (avgStars >= 2.5) return 15;  // decent
  return 5;                         // participated
}

async function awardXpToPlayers(allPlayerIds, ratings) {
  for (const userId of allPlayerIds) {
    // All ratings THIS player received in this game
    const received = ratings.filter(r => r.ratedUserId === userId);

    const xpGain = received.length > 0
      ? xpFromRating(received.reduce((s, r) => s + r.stars, 0) / received.length)
      : 5; // base XP just for participating even if no one rated them

    const user = await User.findById(userId);
    if (!user) continue;

    user.xp += xpGain;

    // Level up check — every 100 XP = 1 level
    const newLevel = Math.floor(user.xp / 100) + 1;
    const didLevelUp = newLevel > user.level;
    if (didLevelUp) user.level = newLevel;

    await user.save();
    console.log(`🎖️ ${user.username} +${xpGain} XP → total ${user.xp} XP | Level ${user.level}${didLevelUp ? ' ⬆️ LEVEL UP!' : ''}`);
  }
}
async function saveDiscussionHistory(gameId, session) {
  try {
    const existing = await GameHistory.findOne({ gameId });
    if (existing) return;

    const teamAIds = session.teamAMembers.split(',').filter(Boolean);
    const teamBIds = session.teamBMembers.split(',').filter(Boolean);

    const buildPlayers = async (ids, team) => {
      return await Promise.all(ids.map(async (userId) => {
        const userData = await R.getUserOnlineData(userId);
        return { userId, username: userData?.username || 'Unknown', team };
      }));
    };

    const teamAPlayers = await buildPlayers(teamAIds, 'teamA');
    const teamBPlayers = await buildPlayers(teamBIds, 'teamB');

    const questions = [];
    const total = parseInt(session.currentQuestionNumber || session.totalQuestions || 1);
    for (let i = 1; i <= total; i++) {
      const text = await R.getDiscussionQuestion(gameId, i);
      if (text) questions.push({ number: i, text });
    }

    const ratings = await R.getGameRatings(gameId);
   

        // ── Award XP based on ratings received ──
        const allPlayerIds = [...teamAIds, ...teamBIds];
        await awardXpToPlayers(allPlayerIds, ratings);
    await GameHistory.create({
      gameId,
      topic: session.topic,
      players: [...teamAPlayers, ...teamBPlayers],
      questions,
      ratings,
      totalQuestions: questions.length,
      playedAt: new Date(),
    });

    await R.deleteGameRatings(gameId);
    console.log(`📝 Game history saved for ${gameId} with ${ratings.length} ratings`);
  } catch (err) {
    console.error('saveDiscussionHistory error:', err.message);
  }
}