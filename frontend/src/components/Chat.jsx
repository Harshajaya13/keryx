import { useState, useRef, useEffect } from 'react';

export default function Chat({ messages, userName, onSend, connected, partnerTyping, onTypingChange }) {
  const [text, setText] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !connected) return;
    onSend(text, isEmergency);
    setText('');
    setIsEmergency(false);
    if (onTypingChange) onTypingChange(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    inputRef.current?.focus();
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (onTypingChange) {
      onTypingChange(val.length > 0);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (val.length > 0) {
        typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 3000);
      }
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status) => {
    if (status === 'read') return <span style={{ color: '#34c759', fontWeight: 'bold', marginLeft: '4px' }}>✓✓</span>;
    if (status === 'delivered') return <span style={{ color: '#8e8e93', fontWeight: 'bold', marginLeft: '4px' }}>✓✓</span>;
    return <span style={{ color: '#8e8e93', marginLeft: '4px' }}>✓</span>;
  };

  // Group consecutive messages by same sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const isNewGroup = !prev || prev.from !== msg.from || msg.time - prev.time > 60000 || msg.from === 'system' || prev?.from === 'system';
    if (isNewGroup) acc.push([msg]);
    else acc[acc.length - 1].push(msg);
    return acc;
  }, []);

  return (
    <div className="chat" style={{ position: 'relative' }}>
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>No messages yet</p>
            <span>Send a message to get started</span>
          </div>
        )}
        {grouped.map((group, gi) => {
          const isSystem = group[0].from === 'system';
          if (isSystem) {
            return (
              <div key={gi} style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                {group.map((msg, mi) => (
                  <div key={msg.id || mi} style={{
                    background: msg.isEmergency ? '#ff3b3030' : '#2c2c2e',
                    border: msg.isEmergency ? '1px solid #ff3b30' : 'none',
                    color: msg.isEmergency ? '#ff3b30' : '#8e8e93',
                    padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span>{msg.text}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>({formatTime(msg.time)})</span>
                  </div>
                ))}
              </div>
            );
          }

          const isMe = group[0].from === userName;
          return (
            <div key={gi} className={`msg-group ${isMe ? 'me' : 'other'}`}>
              {!isMe && <span className="sender-name">{group[0].from}</span>}
              {group.map((msg, mi) => (
                <div key={msg.id || mi} className="msg-row">
                  <div className={`msg-bubble ${isMe ? 'bubble-me' : 'bubble-other'} ${mi === group.length - 1 ? 'bubble-tail' : ''}`}
                    style={msg.isEmergency ? {
                      background: isMe ? '#ff3b30' : '#ff3b3020',
                      border: '1px solid #ff3b30',
                      color: isMe ? 'white' : '#ff3b30'
                    } : {}}
                  >
                    {msg.isEmergency && <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase' }}>🚨 Emergency Alert</div>}
                    <span className="msg-text">{msg.text}</span>
                    <span className="msg-time">
                      {formatTime(msg.time)}
                      {isMe && getStatusIcon(msg.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        
        {partnerTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', color: '#8e8e93', fontSize: '13px', fontStyle: 'italic', animation: 'fadeIn 0.3s ease' }}>
            <span>✍️ Partner is typing…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSend}>
        <div className="composer-inner" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsEmergency(!isEmergency)}
            style={{
              background: isEmergency ? '#ff3b30' : 'transparent',
              border: '1px solid #ff3b30',
              color: isEmergency ? 'white' : '#ff3b30',
              borderRadius: '20px',
              padding: '6px 10px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            title="Toggle Emergency Mode for this message"
          >
            🚨
          </button>

          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleTextChange}
            placeholder={isEmergency ? "🚨 Type emergency message..." : "Message"}
            autoComplete="off"
            disabled={!connected}
            style={isEmergency ? { borderColor: '#ff3b30', background: '#ff3b3010' } : {}}
          />
          <button type="submit" className="send-btn" disabled={!text.trim() || !connected} aria-label="Send"
            style={isEmergency ? { background: '#ff3b30' } : {}}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
