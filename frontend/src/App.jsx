import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import JoinRoom from './components/JoinRoom';
import Chat from './components/Chat';
import CallScreen from './components/CallScreen';

const getSanitizedServerUrl = () => {
  const url = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
const SERVER_URL = getSanitizedServerUrl();

export default function App() {
  const [session, setSession] = useState(null); // { roomCode, userName }
  const {
    connected,
    otherUser,
    messages,
    sendMessage,
    callState,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    isMuted,
    joinError,
  } = useSocket(SERVER_URL, session);

  // Persist session in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fl_session');
    if (saved) {
      try { setSession(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('fl_session', JSON.stringify(session));
  }, [session]);

  const handleLeave = () => {
    localStorage.removeItem('fl_session');
    setSession(null);
    window.location.reload();
  };

  if (!session) {
    return <JoinRoom serverUrl={SERVER_URL} onJoin={setSession} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <button className="header-btn leave-btn" onClick={handleLeave}>
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M7 1L1.5 6.5L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Leave
          </button>
          <div className="header-center">
            <h1>{otherUser || 'Waiting…'}</h1>
            <span className={`header-status ${otherUser ? 'online' : ''} ${!connected ? 'connecting' : ''}`}>
              {!connected ? 'Connecting…' : otherUser ? 'Online' : 'Waiting for partner'}
            </span>
          </div>
          <button
            className="header-btn call-btn"
            onClick={startCall}
            disabled={!otherUser || callState !== 'idle'}
            title={otherUser ? 'Voice call' : 'No one to call'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div className="room-badge">
          Room: <span className="room-code">{session.roomCode}</span>
        </div>
      </header>

      {callState !== 'idle' && (
        <CallScreen
          callState={callState}
          otherName={otherUser || 'Partner'}
          onAnswer={answerCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          isMuted={isMuted}
        />
      )}

      <Chat
        messages={messages}
        userName={session.userName}
        onSend={sendMessage}
        connected={connected}
      />
    </div>
  );
}
