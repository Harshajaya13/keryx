const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { sendPushNotification } = require('./services/fcm');

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

// Health check endpoint for the root path
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

// ── In-memory state ──────────────────────────────────
// rooms[roomCode] = { users: { socketId: name }, messages: [] }
const rooms = {};
const MAX_MESSAGES = 500;
const MAX_ROOM_SIZE = 2;

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char hex
}

// REST endpoint: create a room
app.post('/api/room', (req, res) => {
  const code = generateRoomCode();
  rooms[code] = { users: {}, messages: [], fcmTokens: {} };
  res.json({ code });
});

// REST endpoint: get room messages (for wakeup sync)
app.get('/api/room/:code/messages', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ messages: room.messages });
});

// REST endpoint: check if room exists and has space
app.get('/api/room/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const userCount = Object.keys(room.users).length;
  res.json({ exists: true, full: userCount >= MAX_ROOM_SIZE, userCount });
});



// ── Socket.IO ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join-room', ({ roomCode, userName }) => {
    const code = roomCode.toUpperCase();

    // Auto-create room if it doesn't exist
    if (!rooms[code]) {
      rooms[code] = { users: {}, messages: [], fcmTokens: {} };
    }
    if (!rooms[code].fcmTokens) rooms[code].fcmTokens = {};

    const room = rooms[code];
    const currentUsers = Object.keys(room.users).length;

    // Check if this name is already taken in the room (by another socket)
    const nameTaken = Object.entries(room.users).some(
      ([sid, name]) => name === userName && sid !== socket.id
    );
    if (nameTaken) {
      socket.emit('join-error', 'That name is already taken in this room');
      return;
    }

    if (currentUsers >= MAX_ROOM_SIZE && !room.users[socket.id]) {
      socket.emit('join-error', 'Room is full (max 2 people)');
      return;
    }

    // Join
    socket.join(code);
    socket.roomCode = code;
    socket.userName = userName;
    room.users[socket.id] = userName;

    console.log(`${userName} joined room ${code}`);

    // Send chat history
    socket.emit('chat-history', room.messages);

    // Broadcast status to room
    broadcastRoomStatus(code);
  });

  // Register FCM Token
  socket.on('register-fcm-token', ({ token }) => {
    if (!socket.roomCode || !socket.userName) return;
    const room = rooms[socket.roomCode];
    if (room && token) {
      if (!room.fcmTokens) room.fcmTokens = {};
      room.fcmTokens[socket.userName] = token;
      console.log(`Registered FCM token for ${socket.userName} in room ${socket.roomCode}`);
    }
  });

  // Chat
  socket.on('chat-message', (msg) => {
    if (!socket.roomCode || !socket.userName) return;
    const room = rooms[socket.roomCode];
    if (!room) return;

    const message = {
      id: crypto.randomUUID(),
      from: socket.userName,
      text: msg.text,
      time: Date.now(),
    };
    room.messages.push(message);
    if (room.messages.length > MAX_MESSAGES) room.messages.shift();

    io.to(socket.roomCode).emit('chat-message', message);

    // If other user is offline/sleeping, send push notification
    const targetSocketId = getOtherSocket(socket);
    if (!targetSocketId && room.fcmTokens) {
      for (const [userName, token] of Object.entries(room.fcmTokens)) {
        if (userName !== socket.userName && token) {
          sendPushNotification(token, {
            title: `Message from ${socket.userName}`,
            body: msg.text,
            data: {
              type: 'chat',
              roomCode: socket.roomCode,
              from: socket.userName,
              messageId: message.id,
              time: message.time,
            },
          });
        }
      }
    }
  });

  // ── WebRTC signaling ────────────────────────────────
  socket.on('call-user', (data) => {
    const target = getOtherSocket(socket);
    if (target) {
      io.to(target).emit('incoming-call', { from: socket.userName, offer: data.offer });
    } else {
      // Target is sleeping/offline -> send emergency incoming call push!
      const room = rooms[socket.roomCode];
      if (room && room.fcmTokens) {
        for (const [userName, token] of Object.entries(room.fcmTokens)) {
          if (userName !== socket.userName && token) {
            console.log(`Waking ${userName} for incoming call from ${socket.userName}`);
            sendPushNotification(token, {
              title: `📞 Incoming Voice Call`,
              body: `${socket.userName} is calling you on Keryx!`,
              data: {
                type: 'call',
                roomCode: socket.roomCode,
                from: socket.userName,
                offer: JSON.stringify(data.offer),
              },
            });
          }
        }
      }
    }
  });

  socket.on('call-answer', (data) => {
    const target = getOtherSocket(socket);
    if (target) {
      io.to(target).emit('call-answered', { answer: data.answer });
    }
  });

  socket.on('ice-candidate', (data) => {
    const target = getOtherSocket(socket);
    if (target) {
      io.to(target).emit('ice-candidate', data.candidate);
    }
  });

  socket.on('end-call', () => {
    const target = getOtherSocket(socket);
    if (target) io.to(target).emit('call-ended');
  });

  socket.on('reject-call', () => {
    const target = getOtherSocket(socket);
    if (target) io.to(target).emit('call-rejected');
  });

  // ── Disconnect ──────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`${socket.userName || 'unknown'} disconnected`);
    if (socket.roomCode && rooms[socket.roomCode]) {
      delete rooms[socket.roomCode].users[socket.id];
      broadcastRoomStatus(socket.roomCode);

      // Clean up empty rooms after 1 hour
      const room = rooms[socket.roomCode];
      if (Object.keys(room.users).length === 0) {
        setTimeout(() => {
          if (rooms[socket.roomCode] && Object.keys(rooms[socket.roomCode].users).length === 0) {
            delete rooms[socket.roomCode];
            console.log(`Room ${socket.roomCode} cleaned up`);
          }
        }, 3600000);
      }
    }
  });
});

function getOtherSocket(socket) {
  if (!socket.roomCode || !rooms[socket.roomCode]) return null;
  const room = rooms[socket.roomCode];
  const otherEntry = Object.entries(room.users).find(([sid]) => sid !== socket.id);
  return otherEntry ? otherEntry[0] : null;
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
