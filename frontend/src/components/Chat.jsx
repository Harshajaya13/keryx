import { useState, useRef, useEffect } from 'react';

export default function Chat({ messages, userName, onSend, connected }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !connected) return;
    onSend(text);
    setText('');
    inputRef.current?.focus();
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

  // Group consecutive messages by same sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const isNewGroup = !prev || prev.from !== msg.from || msg.time - prev.time > 60000;
    if (isNewGroup) acc.push([msg]);
    else acc[acc.length - 1].push(msg);
    return acc;
  }, []);

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>No messages yet</p>
            <span>Send a message to get started</span>
          </div>
        )}
        {grouped.map((group, gi) => {
          const isMe = group[0].from === userName;
          return (
            <div key={gi} className={`msg-group ${isMe ? 'me' : 'other'}`}>
              {!isMe && <span className="sender-name">{group[0].from}</span>}
              {group.map((msg, mi) => (
                <div key={msg.id || mi} className="msg-row">
                  <div className={`msg-bubble ${isMe ? 'bubble-me' : 'bubble-other'} ${mi === group.length - 1 ? 'bubble-tail' : ''}`}>
                    <span className="msg-text">{msg.text}</span>
                    <span className="msg-time">{formatTime(msg.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSend}>
        <div className="composer-inner">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message"
            autoComplete="off"
            disabled={!connected}
          />
          <button type="submit" className="send-btn" disabled={!text.trim() || !connected} aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
