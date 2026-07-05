import React from 'react';

export default function CallHistory({ logs = [], onClose }) {
  const formatDuration = (sec) => {
    if (!sec || sec <= 0) return '0s';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getBadge = (type) => {
    switch (type) {
      case 'outgoing':
        return { text: '↗️ Outgoing', bg: '#007aff20', color: '#007aff' };
      case 'incoming':
        return { text: '↙️ Incoming', bg: '#34c75920', color: '#34c759' };
      case 'missed_emergency':
        return { text: '🚨 Missed Emergency', bg: '#ff3b3030', color: '#ff3b30', bold: true };
      case 'missed':
      default:
        return { text: '❌ Missed', bg: '#ff3b3020', color: '#ff3b30' };
    }
  };

  return (
    <div className="call-history-screen animate-in" style={{
      position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0,
      background: '#1c1c1e', zIndex: 50, padding: '16px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', margin: 0, color: 'white' }}>📞 Call History</h2>
        {onClose && (
          <button onClick={onClose} style={{
            background: '#2c2c2e', border: 'none', color: '#007aff', padding: '6px 14px',
            borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer'
          }}>
            Back to Chat
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8e8e93', marginTop: '60px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📵</div>
          <p>No recent call logs</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.map((log) => {
            const badge = getBadge(log.type);
            return (
              <div key={log.id} style={{
                background: '#2c2c2e', borderRadius: '12px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: badge.bold ? '1px solid #ff3b30' : 'none'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: badge.bg, color: badge.color, padding: '2px 8px',
                      borderRadius: '8px', fontSize: '12px', fontWeight: 'bold'
                    }}>
                      {badge.text}
                    </span>
                    <span style={{ color: 'white', fontWeight: '600', fontSize: '15px' }}>
                      {log.type === 'outgoing' ? `To ${log.callee || 'Partner'}` : `From ${log.caller || 'Partner'}`}
                    </span>
                  </div>
                  <span style={{ color: '#8e8e93', fontSize: '13px' }}>
                    {formatTime(log.time)}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    color: log.type.includes('missed') ? '#ff3b30' : '#8e8e93',
                    fontSize: '14px', fontWeight: '500'
                  }}>
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
