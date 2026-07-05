import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import JoinRoom from './components/JoinRoom';
import Chat from './components/Chat';
import CallScreen from './components/CallScreen';
import CallHistory from './components/CallHistory';

const getSanitizedServerUrl = () => {
  const url = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
const SERVER_URL = getSanitizedServerUrl();

export default function App() {
  const [session, setSession] = useState(null); // { token, userName }
  const [showHistory, setShowHistory] = useState(false);

  const {
    connected,
    isSleeping,
    otherUser,
    partnerPresence,
    partnerTyping,
    messages,
    callLogs,
    sendMessage,
    emitTyping,
    callState,
    isEmergencyCall,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    isMuted,
    joinError,
    callError,
    unreadCount,
    markAsRead,
    pushPermission,
    requestPushPermission,
  } = useSocket(SERVER_URL, session);

  useEffect(() => {
    const saved = localStorage.getItem('fl_session_v3');
    if (saved) {
      try { setSession(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('fl_session_v3', JSON.stringify(session));
  }, [session]);

  const handleLeave = () => {
    localStorage.removeItem('fl_session_v3');
    setSession(null);
    window.location.reload();
  };

  if (!session) {
    return <JoinRoom serverUrl={SERVER_URL} onJoin={setSession} />;
  }

  const getStatusText = () => {
    if (isSleeping) return 'Sleeping 💤 (Push active)';
    if (!connected) return 'Connecting…';
    if (otherUser || partnerPresence?.status === 'online') return 'Online 🟢';
    if (partnerPresence?.status === 'in_call') return 'In Call 📞';
    if (partnerPresence?.lastSeen) {
      const d = new Date(Number(partnerPresence.lastSeen));
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `Last seen ${isToday ? 'today at ' : d.toLocaleDateString() + ' '} ${timeStr}`;
    }
    return 'Offline / Sleeping 💤';
  };

  return (
    <div className="app" style={{ position: 'relative' }}>
      <header className="app-header">
        {pushPermission === 'default' && (
          <div className="push-permission-banner" style={{
            background: '#ff9800', color: '#000', padding: '8px 12px', fontSize: '13px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '500'
          }}>
            <span>🔔 Enable notifications to wake app for calls & texts</span>
            <button
              onClick={requestPushPermission}
              style={{ background: '#000', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Enable Push
            </button>
          </div>
        )}

        {callError && (
          <div style={{ background: '#ff3b30', color: 'white', padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', animation: 'fadeIn 0.2s' }}>
            ⚠️ {callError}
          </div>
        )}

        {joinError && (
          <div style={{ background: '#ff3b30', color: 'white', padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', animation: 'fadeIn 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {joinError}</span>
            <button onClick={handleLeave} style={{ background: 'white', color: '#ff3b30', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Re-login</button>
          </div>
        )}

        <div className="header-top">
          <button className="header-btn leave-btn" onClick={handleLeave}>
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M7 1L1.5 6.5L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Leave
          </button>
          
          <div className="header-center" onClick={markAsRead} style={{ cursor: 'pointer' }}>
            <h1>
              {otherUser || (session.userName === 'Mom' ? 'Brother' : 'Mom')}
              {unreadCount > 0 && (
                <span style={{
                  background: '#ff3b30', color: 'white', fontSize: '12px', padding: '2px 8px',
                  borderRadius: '12px', marginLeft: '8px', verticalAlign: 'middle', fontWeight: 'bold'
                }}>
                  {unreadCount} new
                </span>
              )}
            </h1>
            <span className={`header-status ${otherUser || partnerPresence?.status === 'online' ? 'online' : ''} ${!connected || isSleeping ? 'connecting' : ''}`}>
              {getStatusText()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="header-btn call-btn"
              onClick={() => startCall(true)}
              disabled={!connected || callState !== 'idle'}
              title="🚨 Emergency Voice Call (High priority push alert)"
              style={{ background: '#ff3b30', color: 'white', border: 'none' }}
            >
              🚨
            </button>
            <button
              className="header-btn call-btn"
              onClick={() => startCall(false)}
              disabled={!connected || callState !== 'idle'}
              title="Voice Call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div className="room-badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Security: <span className="room-code" style={{ color: '#34c759' }}>Protected 🔒 (30d Token)</span></span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: showHistory ? '#007aff' : '#2c2c2e', color: 'white', border: 'none',
              padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            {showHistory ? '💬 Back to Chat' : `📞 Call History (${callLogs.length})`}
          </button>
        </div>
      </header>

      {callState !== 'idle' && (
        <CallScreen
          callState={callState}
          otherName={(isEmergencyCall ? '🚨 EMERGENCY: ' : '') + (otherUser || 'Partner')}
          onAnswer={answerCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          isMuted={isMuted}
        />
      )}

      {showHistory ? (
        <CallHistory logs={callLogs} onClose={() => setShowHistory(false)} />
      ) : (
        <Chat
          messages={messages}
          userName={session.userName}
          onSend={sendMessage}
          connected={connected}
          partnerTyping={partnerTyping}
          onTypingChange={emitTyping}
        />
      )}
    </div>
  );
}
