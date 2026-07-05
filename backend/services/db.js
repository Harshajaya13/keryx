const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '../keryx.db');
let dbInstance = null;
let isMock = false;

// In-memory fallback if needed before sql.js loads
const mockStore = {
  messages: [],
  call_logs: [],
  user_presence: {},
  failed_logins: [],
};

// Initialize sql.js WebAssembly SQLite
initSqlJs().then((SQL) => {
  let fileBuffer = null;
  try {
    if (fs.existsSync(dbPath)) fileBuffer = fs.readFileSync(dbPath);
  } catch (e) {}

  dbInstance = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  initTables();
  console.log('✅ SQLite (sql.js) database initialized at:', dbPath);
}).catch((err) => {
  console.warn('⚠️ Could not load sql.js. Running database in memory/mock mode.', err.message);
  isMock = true;
});

function saveToDisk() {
  if (!dbInstance || isMock) return;
  try {
    const data = dbInstance.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) { /* ignore read-only fs warnings in some cloud environments */ }
}

function runSql(sql, params = []) {
  if (isMock || !dbInstance) return false;
  try {
    dbInstance.run(sql, params);
    saveToDisk();
    return true;
  } catch (err) {
    console.error('SQL runSql error:', err.message, sql);
    return false;
  }
}

function queryAll(sql, params = []) {
  if (isMock || !dbInstance) return [];
  try {
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('SQL queryAll error:', err.message, sql);
    return [];
  }
}

function initTables() {
  runSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_code TEXT,
      sender TEXT,
      text TEXT,
      time INTEGER,
      status TEXT,
      is_emergency INTEGER DEFAULT 0
    );
  `);

  runSql(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      room_code TEXT,
      caller TEXT,
      callee TEXT,
      type TEXT,
      duration INTEGER,
      time INTEGER
    );
  `);

  runSql(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_name TEXT PRIMARY KEY,
      status TEXT,
      last_seen INTEGER,
      fcm_token TEXT
    );
  `);

  runSql(`
    CREATE TABLE IF NOT EXISTS failed_logins (
      ip TEXT,
      time INTEGER
    );
  `);
}

// ── Messages ──────────────────────────────────────────
function saveMessage({ id, roomCode = 'FAMILY', sender, text, time, status = 'sent', isEmergency = 0 }) {
  if (isMock || !dbInstance) {
    mockStore.messages.push({ id, roomCode, sender, text, time, status, isEmergency });
    return;
  }
  runSql(`
    INSERT OR REPLACE INTO messages (id, room_code, sender, text, time, status, is_emergency)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, roomCode, sender, text, time || Date.now(), status, isEmergency ? 1 : 0]);
}

function getMessages(roomCode = 'FAMILY', limit = 500) {
  if (isMock || !dbInstance) {
    return mockStore.messages.filter(m => m.roomCode === roomCode).slice(-limit);
  }
  return queryAll(`
    SELECT id, room_code AS roomCode, sender AS from_user, sender AS "from", text, time, status, is_emergency AS isEmergency
    FROM messages WHERE room_code = ? ORDER BY time ASC LIMIT ?
  `, [roomCode, limit]);
}

function updateMessageStatus(id, status) {
  if (isMock || !dbInstance) {
    const m = mockStore.messages.find(msg => msg.id === id);
    if (m) m.status = status;
    return;
  }
  runSql(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
}

function updateAllMessagesStatusForUser(roomCode = 'FAMILY', recipientName, newStatus) {
  if (isMock || !dbInstance) {
    mockStore.messages.forEach(m => {
      if (m.roomCode === roomCode && m.sender !== recipientName && (m.status === 'sent' || m.status === 'delivered')) {
        m.status = newStatus;
      }
    });
    return;
  }
  runSql(`
    UPDATE messages SET status = ?
    WHERE room_code = ? AND sender != ? AND status != 'read'
  `, [newStatus, roomCode, recipientName]);
}

// ── Call Logs ─────────────────────────────────────────
function saveCallLog({ id, roomCode = 'FAMILY', caller, callee, type, duration = 0, time }) {
  if (isMock || !dbInstance) {
    mockStore.call_logs.push({ id, roomCode, caller, callee, type, duration, time });
    return;
  }
  runSql(`
    INSERT INTO call_logs (id, room_code, caller, callee, type, duration, time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, roomCode, caller, callee || 'Partner', type, duration, time || Date.now()]);
}

function getCallLogs(roomCode = 'FAMILY', limit = 100) {
  if (isMock || !dbInstance) {
    return mockStore.call_logs.filter(c => c.roomCode === roomCode).reverse().slice(0, limit);
  }
  return queryAll(`
    SELECT id, room_code AS roomCode, caller, callee, type, duration, time
    FROM call_logs WHERE room_code = ? ORDER BY time DESC LIMIT ?
  `, [roomCode, limit]);
}

// ── Presence ──────────────────────────────────────────
function updatePresence(userName, status, lastSeen, fcmToken = null) {
  if (isMock || !dbInstance) {
    const existing = mockStore.user_presence[userName] || {};
    mockStore.user_presence[userName] = {
      userName,
      status: status || existing.status || 'offline',
      lastSeen: lastSeen || existing.lastSeen || Date.now(),
      fcmToken: fcmToken !== null ? fcmToken : existing.fcmToken,
    };
    return;
  }
  if (fcmToken !== null) {
    runSql(`
      INSERT OR REPLACE INTO user_presence (user_name, status, last_seen, fcm_token)
      VALUES (?, ?, ?, ?)
    `, [userName, status, lastSeen, fcmToken]);
  } else {
    runSql(`
      INSERT INTO user_presence (user_name, status, last_seen)
      VALUES (?, ?, ?)
      ON CONFLICT(user_name) DO UPDATE SET
        status = excluded.status,
        last_seen = excluded.last_seen
    `, [userName, status, lastSeen]);
  }
}

function getPresence() {
  if (isMock || !dbInstance) return Object.values(mockStore.user_presence);
  return queryAll(`SELECT user_name AS userName, status, last_seen AS lastSeen, fcm_token AS fcmToken FROM user_presence`);
}

function getFcmTokenForUser(userName) {
  if (isMock || !dbInstance) return mockStore.user_presence[userName]?.fcmToken || null;
  const rows = queryAll(`SELECT fcm_token FROM user_presence WHERE user_name = ?`, [userName]);
  return rows.length > 0 ? rows[0].fcm_token : null;
}

function getAllOtherFcmTokens(userName) {
  if (isMock || !dbInstance) {
    return Object.values(mockStore.user_presence)
      .filter(u => u.userName !== userName && u.fcmToken)
      .map(u => ({ userName: u.userName, token: u.fcmToken }));
  }
  return queryAll(`SELECT user_name AS userName, fcm_token AS token FROM user_presence WHERE user_name != ? AND fcm_token IS NOT NULL AND fcm_token != ''`, [userName]);
}

// ── Security / Failed Logins ──────────────────────────
function recordFailedLogin(ip) {
  const time = Date.now();
  if (isMock || !dbInstance) {
    mockStore.failed_logins.push({ ip, time });
    return;
  }
  runSql(`INSERT INTO failed_logins (ip, time) VALUES (?, ?)`, [ip, time]);
}

function getFailedLoginsCount(ip, windowMs = 3600000) {
  const cutoff = Date.now() - windowMs;
  if (isMock || !dbInstance) {
    return mockStore.failed_logins.filter(f => f.ip === ip && f.time > cutoff).length;
  }
  const rows = queryAll(`SELECT COUNT(*) AS count FROM failed_logins WHERE ip = ? AND time > ?`, [ip, cutoff]);
  return rows.length > 0 ? rows[0].count : 0;
}

// ── Auto Cleanup (30 Days) ────────────────────────────
function runAutoCleanup() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  if (isMock || !dbInstance) {
    mockStore.call_logs = mockStore.call_logs.filter(c => c.time >= thirtyDaysAgo);
    mockStore.failed_logins = mockStore.failed_logins.filter(f => f.time >= thirtyDaysAgo);
    return;
  }
  runSql(`DELETE FROM call_logs WHERE time < ?`, [thirtyDaysAgo]);
  runSql(`DELETE FROM failed_logins WHERE time < ?`, [thirtyDaysAgo]);
  console.log('🧹 30-Day Auto Cleanup executed.');
}

// Run cleanup once every 24 hours
setInterval(runAutoCleanup, 24 * 60 * 60 * 1000);

module.exports = {
  saveMessage,
  getMessages,
  updateMessageStatus,
  updateAllMessagesStatusForUser,
  saveCallLog,
  getCallLogs,
  updatePresence,
  getPresence,
  getFcmTokenForUser,
  getAllOtherFcmTokens,
  recordFailedLogin,
  getFailedLoginsCount,
  runAutoCleanup,
};
