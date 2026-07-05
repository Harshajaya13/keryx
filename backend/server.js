const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendPushNotification } = require('./services/fcm');
const db = require('./services/db');

// ── Strict Family Key Requirement (Phase 3 Requirement 2) ──
if (!process.env.FAMILY_KEY_HASH) {
  console.error('❌ FATAL ERROR: FAMILY_KEY_HASH environment variable must be configured.');
  console.error('❌ Never silently use a default key in production or development. Refusing to start.');
  process.exit(1);
}
const getFamilyKeyHash = () => process.env.FAMILY_KEY_HASH;

// ── Secure Signed Session Tokens (30 Days) ─────────────
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSessionToken(userName) {
  const expires = Date.now() + SESSION_DURATION_MS;
  const payload = `${userName}:${expires}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifySessionToken(tokenStr) {
  try {
    if (!tokenStr) return null;
    const decoded = Buffer.from(tokenStr, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [userName, expiresStr, hmac] = parts;
    if (Number(expiresStr) < Date.now()) return null; // Token expired
    const payload = `${userName}:${expiresStr}`;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (hmac === expectedHmac) return userName;
  } catch (e) {
    return null;
  }
  return null;
}

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
  res.send('Family Link API is running (Protected by Phase 3 Security)');
});

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

// Family Key Verification -> issues 30-day session token
app.post('/api/verify-key', async (req, res) => {
  const { familyKey, userName } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!userName || !['Mom', 'Brother'].includes(userName)) {
    return res.status(400).json({ error: 'Please select a valid identity (Mom or Brother)' });
  }

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

  // Generate 30-day signed session token
  const token = generateSessionToken(userName);
  res.json({ success: true, token, userName });
});

// Protected API Middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization || req.query.token;
  const userName = verifySessionToken(token);
  if (!userName) {
    return res.status(401).json({ error: 'Unauthorized or session expired. Please log in again.' });
  }
  req.userName = userName;
  next();
}

// Get messages (Protected, no room code required by client)
app.get('/api/messages', requireAuth, (req, res) => {
  const messages = db.getMessages('FAMILY', 500);
  res.json({ messages });
});

// Get call logs (Protected, no room code required by client)
app.get('/api/calls', requireAuth, (req, res) => {
  const logs = db.getCallLogs('FAMILY', 100);
  res.json({ logs });
});

// Check status (Protected)
const rooms = { FAMILY: { users: {}, fcmTokens: {} } };
app.get('/api/status', requireAuth, (req, res) => {
  const room = rooms['FAMILY'];
  const userCount = room ? Object.keys(room.users).length : 0;
  res.json({ exists: true, full: userCount >= 2, userCount, userName: req.userName });
});

// ── Socket.IO ────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  socket.callAttempts = [];

  socket.on('join-room', ({ token }) => {
    // Validate signed session token
    const userName = verifySessionToken(token);
    if (!userName) {
      socket.emit('join-error', 'Session expired or invalid. Please re-enter Family Key.');
      return;
    }

    const code = 'FAMILY'; // Single private family room internally
    const room = rooms[code];

    // Check if name taken by another socket
    const nameTaken = Object.entries(room.users).some(([sid, name]) => name === userName && sid !== socket.id);
    if (nameTaken) {
      // If same user reconnecting from new tab/connection, allow takeover
      console.log(`Takeover connection for ${userName}`);
    }

    if (Object.keys(room.users).length >= 2 && !room.users[socket.id]) {
      socket.emit('join-error', 'Room is full (max 2 people)');
      return;
    }

    socket.join(code);
    socket.roomCode = code;
    socket.userName = userName;
    room.users[socket.id] = userName;

    console.log(`${userName} joined internal family room`);

    db.updateAllMessagesStatusForUser(code, userName, 'read');
    db.updatePresence(userName, 'online', Date.now());

    socket.emit('chat-history', db.getMessages(code, 500));
    socket.emit('call-logs-update', db.getCallLogs(code, 100));

    broadcastRoomStatus(code);
    io.to(code).emit('presence-update', db.getPresence());
    socket.to(code).emit('messages-status-update', { updatedBy: userName, status: 'read' });
  });

  socket.on('register-fcm-token', ({ token }) => {
    if (!socket.roomCode || !socket.userName) return;
    const room = rooms[socket.roomCode];
    if (room && token) {
      room.fcmTokens[socket.userName] = token;
      db.updatePresence(socket.userName, 'online', Date.now(), token);
      console.log(`Registered FCM token for ${socket.userName}`);
    }
  });

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

  socket.on('message-read', () => {
    if (!socket.roomCode || !socket.userName) return;
    db.updateAllMessagesStatusForUser(socket.roomCode, socket.userName, 'read');
    socket.to(socket.roomCode).emit('messages-status-update', { updatedBy: socket.userName, status: 'read' });
  });

  socket.on('call-user', (data) => {
    if (!socket.roomCode || !socket.userName) return;

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

    if (socket.activeCallStart) {
      const duration = Math.round((Date.now() - socket.activeCallStart) / 1000);
      const isMissed = reason === 'reject' || duration < 2;
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
