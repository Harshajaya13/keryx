const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendPushNotification } = require('./services/fcm');
const db = require('./services/db');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

const getSanitizedFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
const FRONTEND_URL = getSanitizedFrontendUrl();

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173'] }));
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Family Link API is running');
});

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Family Key Hash Configuration ──────────────────────
// Default fallback hash is for 'ramatulasi'
const DEFAULT_FAMILY_KEY_HASH = bcrypt.hashSync('ramatulasi', 10);
const getFamilyKeyHash = () => process.env.FAMILY_KEY_HASH || DEFAULT_FAMILY_KEY_HASH;

// ── Admin Notification Helper ──────────────────────────
function sendAdminNotification(messageText) {
  console.log('🚨 ADMIN ALERT:', messageText);
  if (process.env.ADMIN_FCM_TOKEN) {
    sendPushNotification(process.env.ADMIN_FCM_TOKEN, {
      title: '⚠️ Keryx Admin Alert',
      body: messageText,
      data: { type: 'admin_alert', time: String(Date.now()) },
    });
  }
  const presence = db.getPresence();
  for (const u of presence) {
    if ((u.userName.toLowerCase() === 'admin' || u.userName.toLowerCase() === 'harsha') && u.fcmToken) {
      sendPushNotification(u.fcmToken, {
        title: '⚠️ Keryx Admin Alert',
        body: messageText,
        data: { type: 'admin_alert', time: String(Date.now()) },
      });
    }
  }
}

// ── REST Endpoints ─────────────────────────────────────

// Family Key Verification
app.post('/api/verify-key', async (req, res) => {
  const { familyKey, userName } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Check rate limit (max 5 failed attempts per hour per IP)
  const failCount = db.getFailedLoginsCount(ip, 3600000);
  if (failCount >= 5) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please try again later.' });
  }

  const isValid = await bcrypt.compare(familyKey || '', getFamilyKeyHash());
  if (!isValid) {
    db.recordFailedLogin(ip);
    const newCount = db.getFailedLoginsCount(ip, 3600000);
    if (newCount >= 3) {
      sendAdminNotification(`⚠️ Someone attempted to access Keryx using an invalid Family Key from IP ${ip} (${newCount} attempts).`);
    }
    return res.status(401).json({
      error: 'Invalid Family Key',
      remainingAttempts: Math.max(0, 5 - newCount),
    });
  }

  res.json({ success: true, roomCode: 'FAMILY' });
});

// Get room messages from SQLite
app.get('/api/room/:code/messages', (req, res) => {
  const code = req.params.code.toUpperCase();
  const messages = db.getMessages(code, 500);
  res.json({ messages });
});

// Get room call logs from SQLite
app.get('/api/room/:code/calls', (req, res) => {
  const code = req.params.code.toUpperCase();
  const logs = db.getCallLogs(code, 100);
  res.json({ logs });
});

// Check room status
const rooms = {};
app.get('/api/room/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  const userCount = room ? Object.keys(room.users).length : 0;
  res.json({ exists: true, full: userCount >= 2, userCount });
});

// ── Socket.IO ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  socket.callAttempts = []; // for rate limiting

  socket.on('join-room', ({ roomCode, userName }) => {
    const code = (roomCode || 'FAMILY').toUpperCase();
    if (!rooms[code]) {
      rooms[code] = { users: {}, fcmTokens: {} };
    }
    const room = rooms[code];

    // Check if name taken
    const nameTaken = Object.entries(room.users).some(([sid, name]) => name === userName && sid !== socket.id);
    if (nameTaken) {
      socket.emit('join-error', 'That name is already taken in this room');
      return;
    }

    if (Object.keys(room.users).length >= 2 && !room.users[socket.id]) {
      socket.emit('join-error', 'Room is full (max 2 people)');
      return;
    }

    socket.join(code);
    socket.roomCode = code;
    socket.userName = userName;
    room.users[socket.id] = userName;

    console.log(`${userName} joined room ${code}`);

    // Mark partner's sent messages as delivered/read since user opened app
    db.updateAllMessagesStatusForUser(code, userName, 'read');
    db.updatePresence(userName, 'online', Date.now());

    // Send SQLite history
    socket.emit('chat-history', db.getMessages(code, 500));
    socket.emit('call-logs-update', db.getCallLogs(code, 100));

    // Broadcast status & presence
    broadcastRoomStatus(code);
    io.to(code).emit('presence-update', db.getPresence());
    socket.to(code).emit('messages-status-update', { updatedBy: userName, status: 'read' });
  });

  // FCM Token Registration
  socket.on('register-fcm-token', ({ token }) => {
    if (!socket.roomCode || !socket.userName) return;
    const room = rooms[socket.roomCode];
    if (room && token) {
      room.fcmTokens[socket.userName] = token;
      db.updatePresence(socket.userName, 'online', Date.now(), token);
      console.log(`Registered FCM token for ${socket.userName}`);
    }
  });

  // Typing Indicators
  socket.on('typing-start', () => {
    if (socket.roomCode && socket.userName) {
      socket.to(socket.roomCode).emit('user-typing', { user: socket.userName, isTyping: true });
    }
  });

  socket.on('typing-stop', () => {
    if (socket.roomCode && socket.userName) {
      socket.to(socket.roomCode).emit('user-typing', { user: socket.userName, isTyping: false });
    }
  });

  // Chat Messages
  socket.on('chat-message', (msg) => {
    if (!socket.roomCode || !socket.userName) return;
    const room = rooms[socket.roomCode];
    if (!room) return;

    const targetSocketId = getOtherSocket(socket);
    const initialStatus = targetSocketId ? 'delivered' : 'sent';

    const message = {
      id: crypto.randomUUID(),
      roomCode: socket.roomCode,
      sender: socket.userName,
      text: msg.text,
      time: Date.now(),
      status: initialStatus,
      isEmergency: msg.isEmergency ? 1 : 0,
    };

    db.saveMessage(message);

    // Format for client
    const clientMsg = {
      id: message.id,
      from: socket.userName,
      text: message.text,
      time: message.time,
      status: message.status,
      isEmergency: message.isEmergency,
    };

    io.to(socket.roomCode).emit('chat-message', clientMsg);

    if (msg.isEmergency) {
      sendAdminNotification(`🚨 Emergency message sent by ${socket.userName} on Keryx!`);
    }

    // Push notification if partner offline/sleeping
    if (!targetSocketId) {
      const partnerToken = db.getFcmTokenForUser(getOtherUserName(socket));
      if (partnerToken) {
        sendPushNotification(partnerToken, {
          title: msg.isEmergency ? `🚨 EMERGENCY from ${socket.userName}` : `Message from ${socket.userName}`,
          body: msg.text,
          data: {
            type: 'chat',
            roomCode: socket.roomCode,
            from: socket.userName,
            messageId: message.id,
            time: String(message.time),
          },
        });
      }
    }
  });

  // Message acknowledgments
  socket.on('message-read', () => {
    if (!socket.roomCode || !socket.userName) return;
    db.updateAllMessagesStatusForUser(socket.roomCode, socket.userName, 'read');
    socket.to(socket.roomCode).emit('messages-status-update', { updatedBy: socket.userName, status: 'read' });
  });

  // ── WebRTC Signaling & Anti-Spam ────────────────────
  socket.on('call-user', (data) => {
    if (!socket.roomCode || !socket.userName) return;

    // Anti-Spam: Max 5 call attempts per minute
    const now = Date.now();
    socket.callAttempts = (socket.callAttempts || []).filter(t => t > now - 60000);
    if (socket.callAttempts.length >= 5) {
      socket.emit('call-error', 'Too many calls. Please wait one minute.');
      return;
    }
    socket.callAttempts.push(now);

    socket.activeCallStart = now;
    socket.activeCallType = data.isEmergency ? 'emergency' : 'normal';
    db.updatePresence(socket.userName, 'in_call', now);
    io.to(socket.roomCode).emit('presence-update', db.getPresence());

    if (data.isEmergency) {
      sendAdminNotification(`🚨 Emergency Voice Call initiated by ${socket.userName}!`);
    }

    const target = getOtherSocket(socket);
    if (target) {
      io.to(target).emit('incoming-call', { from: socket.userName, offer: data.offer, isEmergency: data.isEmergency });
    } else {
      // Target sleeping/offline -> send emergency incoming call push!
      const partnerToken = db.getFcmTokenForUser(getOtherUserName(socket));
      if (partnerToken) {
        console.log(`Waking partner for voice call from ${socket.userName}`);
        sendPushNotification(partnerToken, {
          title: data.isEmergency ? `🚨 EMERGENCY VOICE CALL` : `📞 Incoming Voice Call`,
          body: `${socket.userName} is calling you on Keryx!`,
          data: {
            type: 'call',
            roomCode: socket.roomCode,
            from: socket.userName,
            isEmergency: data.isEmergency ? 'true' : 'false',
            offer: JSON.stringify(data.offer),
          },
        });
      }
    }
  });

  socket.on('call-answer', (data) => {
    const target = getOtherSocket(socket);
    socket.activeCallStart = Date.now();
    if (target) {
      const targetSocket = io.sockets.sockets.get(target);
      if (targetSocket) targetSocket.activeCallStart = Date.now();
      io.to(target).emit('call-answered', { answer: data.answer });
    }
  });

  socket.on('ice-candidate', (data) => {
    const target = getOtherSocket(socket);
    if (target) io.to(target).emit('ice-candidate', data.candidate);
  });

  const handleCallTermination = (reason) => {
    if (!socket.roomCode || !socket.userName) return;
    const target = getOtherSocket(socket);
    if (target) {
      if (reason === 'reject') io.to(target).emit('call-rejected');
      else io.to(target).emit('call-ended');
    }

    // Calculate duration & log call
    if (socket.activeCallStart) {
      const duration = Math.round((Date.now() - socket.activeCallStart) / 1000);
      const isMissed = reason === 'reject' || duration < 2; // under 2 seconds or rejected = missed
      const callType = isMissed ? (socket.activeCallType === 'emergency' ? 'missed_emergency' : 'missed') : 'outgoing';

      db.saveCallLog({
        id: crypto.randomUUID(),
        roomCode: socket.roomCode,
        caller: socket.userName,
        callee: getOtherUserName(socket) || 'Partner',
        type: callType,
        duration: isMissed ? 0 : duration,
      });

      if (isMissed) {
        const missedMsg = {
          id: crypto.randomUUID(),
          roomCode: socket.roomCode,
          sender: 'system',
          text: socket.activeCallType === 'emergency' ? `🚨 Missed Emergency Call from ${socket.userName}` : `📞 Missed Call from ${socket.userName}`,
          time: Date.now(),
          status: 'read',
          isEmergency: socket.activeCallType === 'emergency' ? 1 : 0,
        };
        db.saveMessage(missedMsg);
        io.to(socket.roomCode).emit('chat-message', {
          id: missedMsg.id,
          from: 'system',
          text: missedMsg.text,
          time: missedMsg.time,
          status: 'read',
          isEmergency: missedMsg.isEmergency,
        });

        if (socket.activeCallType === 'emergency') {
          sendAdminNotification(`🚨 Missed Emergency Call! ${socket.userName} called but nobody answered.`);
        }
      }

      socket.activeCallStart = null;
      db.updatePresence(socket.userName, 'online', Date.now());
      io.to(socket.roomCode).emit('presence-update', db.getPresence());
      io.to(socket.roomCode).emit('call-logs-update', db.getCallLogs(socket.roomCode, 100));
    }
  };

  socket.on('end-call', () => handleCallTermination('end'));
  socket.on('reject-call', () => handleCallTermination('reject'));

  // ── Disconnect ──────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`${socket.userName || 'unknown'} disconnected`);
    if (socket.roomCode && rooms[socket.roomCode]) {
      if (socket.activeCallStart) handleCallTermination('disconnect');

      delete rooms[socket.roomCode].users[socket.id];
      db.updatePresence(socket.userName, 'sleeping', Date.now());

      broadcastRoomStatus(socket.roomCode);
      io.to(socket.roomCode).emit('presence-update', db.getPresence());
    }
  });
});

function getOtherSocket(socket) {
  if (!socket.roomCode || !rooms[socket.roomCode]) return null;
  const room = rooms[socket.roomCode];
  const otherEntry = Object.entries(room.users).find(([sid]) => sid !== socket.id);
  return otherEntry ? otherEntry[0] : null;
}

function getOtherUserName(socket) {
  if (!socket.roomCode || !rooms[socket.roomCode]) return 'Partner';
  const room = rooms[socket.roomCode];
  const otherEntry = Object.entries(room.users).find(([sid]) => sid !== socket.id);
  return otherEntry ? otherEntry[1] : (socket.userName === 'Mom' ? 'Brother' : 'Mom');
}

function broadcastRoomStatus(code) {
  const room = rooms[code];
  if (!room) return;
  const userList = Object.entries(room.users).map(([sid, name]) => ({ id: sid, name }));
  io.to(code).emit('room-status', { users: userList });
}

server.listen(PORT, () => {
  console.log(`Family Link server running on port ${PORT}`);
});
