import { useEffect, useState } from 'react';

export default function CallScreen({ callState, otherName, onAnswer, onReject, onEnd, onToggleMute, isMuted }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (callState !== 'active') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-overlay">
      <div className="call-screen">
        {/* Avatar */}
        <div className="call-avatar">
          <div className={`avatar-circle ${callState === 'incoming' ? 'avatar-ring' : ''} ${callState === 'active' ? 'avatar-active' : ''}`}>
            <span>{otherName.charAt(0).toUpperCase()}</span>
          </div>
        </div>

        <h2 className="call-name">{otherName}</h2>

        {callState === 'incoming' && <p className="call-status">Incoming Voice Call…</p>}
        {callState === 'calling' && <p className="call-status call-status-pulse">Calling…</p>}
        {callState === 'active' && <p className="call-status call-status-active">{formatTime(elapsed)}</p>}

        <div className="call-controls">
          {callState === 'active' && (
            <button className={`call-control-btn ${isMuted ? 'control-active' : ''}`} onClick={onToggleMute}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                {isMuted ? (
                  <><path d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 16.95A7 7 0 015 12m14 0a7 7 0 01-.11 1.23M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
                ) : (
                  <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
                )}
              </svg>
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}

          {callState === 'incoming' && (
            <>
              <button className="call-control-btn control-reject" onClick={onReject}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                <span>Decline</span>
              </button>
              <button className="call-control-btn control-accept" onClick={onAnswer}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Accept</span>
              </button>
            </>
          )}

          {(callState === 'active' || callState === 'calling') && (
            <button className="call-control-btn control-reject" onClick={onEnd}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>End</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
