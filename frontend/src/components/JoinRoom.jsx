import { useState } from 'react';

export default function JoinRoom({ serverUrl, onJoin }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${serverUrl}/api/room`, { method: 'POST' });
      if (!res.ok) throw new Error('Response not OK');
      const data = await res.json();
      setCreatedCode(data.code);
      setMode('created');
      setLoading(false);
    } catch (err) {
      setError(`Could not reach server at: ${serverUrl || 'relative path'}`);
      setMode(null);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!roomCode.trim()) { setError('Enter the room code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${serverUrl}/api/room/${roomCode.toUpperCase()}`);
      if (!res.ok) { setError('Room not found'); setLoading(false); return; }
      const data = await res.json();
      if (data.full) { setError('Room is full'); setLoading(false); return; }
      onJoin({ roomCode: roomCode.toUpperCase(), userName: name.trim() });
    } catch (err) {
      setError(`Could not reach server at: ${serverUrl || 'relative path'}`);
      setMode(null);
      setLoading(false);
    }
  };

  const enterCreatedRoom = () => {
    onJoin({ roomCode: createdCode, userName: name.trim() });
  };

  return (
    <div className="join-screen">
      <div className="join-container">
        <div className="join-logo">
          <div className="logo-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1>Family Link</h1>
          <p className="join-subtitle">Private voice & chat for two</p>
        </div>

        {!mode && (
          <div className="join-form animate-in">
            <div className="input-group">
              <label>Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoComplete="off"
              />
            </div>
            <div className="join-buttons">
              <button className="btn-primary" onClick={() => { if(!name.trim()){setError('Enter your name');return;} setError(''); handleCreate(); }} disabled={loading}>
                Create Room
              </button>
              <button className="btn-secondary" onClick={() => { if(!name.trim()){setError('Enter your name');return;} setError(''); setMode('join'); }}>
                Join Room
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="join-form animate-in">
            <div className="input-group">
              <label>Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. A3F1B2"
                maxLength={6}
                autoComplete="off"
                style={{ letterSpacing: '4px', textAlign: 'center', fontWeight: 600 }}
              />
            </div>
            <div className="join-buttons">
              <button className="btn-primary" onClick={handleJoin} disabled={loading}>
                {loading ? 'Joining…' : 'Join'}
              </button>
              <button className="btn-ghost" onClick={() => { setMode(null); setError(''); }}>Back</button>
            </div>
          </div>
        )}

        {mode === 'created' && (
          <div className="join-form animate-in">
            <div className="code-display">
              <label>Share this code</label>
              <div className="code-value">{createdCode}</div>
              <p className="code-hint">Send this to the person you want to chat with</p>
            </div>
            <button className="btn-primary" onClick={enterCreatedRoom}>Enter Room</button>
          </div>
        )}

        {error && <div className="join-error animate-in">{error}</div>}
      </div>
    </div>
  );
}
