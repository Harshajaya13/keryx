import { useState } from 'react';

export default function JoinRoom({ serverUrl, onJoin }) {
  const [name, setName] = useState('Mom');
  const [familyKey, setFamilyKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleEnter = async (e) => {
    if (e) e.preventDefault();
    if (!name) { setError('Please select who you are (Mom or Brother)'); return; }
    if (!familyKey.trim()) { setError('Please enter the Family Key'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${serverUrl}/api/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: name, familyKey: familyKey.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError('Too many incorrect attempts. Please try again later.');
        setLoading(false);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid Family Key. Please try again.');
        setLoading(false);
        return;
      }

      // Store signed 30-day session token
      onJoin({ token: data.token, userName: name });
    } catch (err) {
      setError(`Could not connect to server at: ${serverUrl || 'localhost'}`);
      setLoading(false);
    }
  };

  return (
    <div className="join-screen">
      <div className="join-container" style={{ maxWidth: '380px' }}>
        <div className="join-logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
            </svg>
          </div>
          <h1>Family Link</h1>
          <p className="join-subtitle">Private family voice & chat</p>
        </div>

        <form onSubmit={handleEnter} className="join-form animate-in">
          <div className="input-group">
            <label>Who are you?</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setName('Mom')}
                style={{
                  flex: 1, padding: '14px 10px', borderRadius: '12px', border: '2px solid',
                  borderColor: name === 'Mom' ? '#007aff' : '#3a3a3c',
                  background: name === 'Mom' ? '#007aff20' : '#2c2c2e',
                  color: name === 'Mom' ? '#fff' : '#8e8e93',
                  fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>👩</span> Mom {name === 'Mom' && '🟢'}
              </button>
              <button
                type="button"
                onClick={() => setName('Brother')}
                style={{
                  flex: 1, padding: '14px 10px', borderRadius: '12px', border: '2px solid',
                  borderColor: name === 'Brother' ? '#007aff' : '#3a3a3c',
                  background: name === 'Brother' ? '#007aff20' : '#2c2c2e',
                  color: name === 'Brother' ? '#fff' : '#8e8e93',
                  fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>👦</span> Brother {name === 'Brother' && '🟢'}
              </button>
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '16px' }}>
            <label>Family Key</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={familyKey}
                onChange={(e) => setFamilyKey(e.target.value)}
                placeholder="Enter shared Family Key"
                autoComplete="off"
                style={{ width: '100%', paddingRight: '40px', fontSize: '16px', letterSpacing: showKey ? 'normal' : '2px' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', right: '10px', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#8e8e93', fontSize: '16px', padding: '4px'
                }}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? '👁️' : '🔒'}
              </button>
            </div>
            <p className="code-hint" style={{ marginTop: '6px', fontSize: '12px' }}>
              Only family members with the key can enter.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '16px', padding: '14px', fontSize: '16px', fontWeight: 'bold' }}>
            {loading ? 'Verifying…' : 'Enter Keryx'}
          </button>
        </form>

        {error && <div className="join-error animate-in" style={{ marginTop: '16px' }}>{error}</div>}
      </div>
    </div>
  );
}
