import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { usePushNotifications } from './usePushNotifications';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useSocket(serverUrl, session) {
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidateQueue = useRef([]);

  const [connected, setConnected] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [partnerPresence, setPartnerPresence] = useState(null);
  const [messages, setMessages] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [callState, setCallState] = useState('idle');
  const [isEmergencyCall, setIsEmergencyCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [callError, setCallError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const { permission, requestPermissionAndRegister } = usePushNotifications(socketRef.current, session);

  const syncFromRest = useCallback(async () => {
    if (!session?.roomCode) return;
    try {
      const [msgRes, callRes] = await Promise.all([
        fetch(`${serverUrl}/api/room/${session.roomCode}/messages`),
        fetch(`${serverUrl}/api/room/${session.roomCode}/calls`),
      ]);
      if (msgRes.ok) {
        const data = await msgRes.json();
        if (data.messages) setMessages(data.messages);
      }
      if (callRes.ok) {
        const data = await callRes.json();
        if (data.logs) setCallLogs(data.logs);
      }
    } catch (err) { console.error('REST sync error:', err); }
  }, [serverUrl, session?.roomCode]);

  // ── Socket connection ──────────────────────────────
  useEffect(() => {
    if (!session) return;

    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setIsSleeping(false);
      socket.emit('join-room', { roomCode: session.roomCode, userName: session.userName });
      syncFromRest();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setOtherUser(null);
      setPartnerPresence((prev) => prev ? { ...prev, status: 'offline', lastSeen: Date.now() } : null);
    });

    socket.on('reconnect', () => {
      setConnected(true);
      setIsSleeping(false);
      socket.emit('join-room', { roomCode: session.roomCode, userName: session.userName });
      syncFromRest();
    });

    socket.on('join-error', (msg) => setJoinError(msg));
    socket.on('call-error', (msg) => {
      setCallError(msg);
      setTimeout(() => setCallError(null), 5000);
      cleanupCall();
    });

    socket.on('room-status', ({ users }) => {
      const other = users.find((u) => u.name !== session.userName);
      setOtherUser(other ? other.name : null);
    });

    socket.on('presence-update', (list) => {
      const other = list.find((u) => u.userName !== session.userName);
      if (other) setPartnerPresence(other);
    });

    socket.on('chat-history', (history) => setMessages(history));
    socket.on('call-logs-update', (logs) => setCallLogs(logs));
    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.from !== session.userName && document.visibilityState === 'visible') {
        socket.emit('message-read');
      }
    });

    socket.on('messages-status-update', ({ status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.from === session.userName && m.status !== 'read' ? { ...m, status } : m))
      );
    });

    socket.on('user-typing', ({ isTyping }) => setPartnerTyping(isTyping));

    // WebRTC
    socket.on('incoming-call', (data) => {
      setCallState('incoming');
      setIsEmergencyCall(!!data.isEmergency);
      setIncomingOffer(data.offer);
    });

    socket.on('call-answered', async (data) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          while (iceCandidateQueue.current.length > 0) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.current.shift()));
          }
          setCallState('active');
        }
      } catch (e) { console.error('Answer error:', e); }
    });

    socket.on('ice-candidate', async (candidate) => {
      try {
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidateQueue.current.push(candidate);
        }
      } catch (e) { console.error('ICE error:', e); }
    });

    socket.on('call-ended', () => cleanupCall());
    socket.on('call-rejected', () => cleanupCall());

    return () => {
      socket.disconnect();
      cleanupCall();
    };
  }, [session, serverUrl, syncFromRest]);

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    iceCandidateQueue.current = [];
    setCallState('idle');
    setIsEmergencyCall(false);
    setIsMuted(false);
    setIncomingOffer(null);
  }, []);

  // ── Idle Sleep & Reconnect Logic ─────────────────────
  useEffect(() => {
    if (!session) return;
    let sleepTimer = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (callState === 'idle') {
          sleepTimer = setTimeout(() => {
            if (socketRef.current && socketRef.current.connected) {
              console.log('💤 App idle in background. Disconnecting socket to save battery.');
              socketRef.current.disconnect();
              setIsSleeping(true);
            }
          }, 15000);
        }
      } else if (document.visibilityState === 'visible') {
        if (sleepTimer) clearTimeout(sleepTimer);
        if (socketRef.current && (!socketRef.current.connected || isSleeping)) {
          console.log('☀️ App woken up. Reconnecting socket and syncing...');
          socketRef.current.connect();
          setIsSleeping(false);
          syncFromRest();
        }
        markAsRead();
        if (socketRef.current) socketRef.current.emit('message-read');
      }
    };

    const handleOnline = () => {
      if (socketRef.current && !socketRef.current.connected && document.visibilityState === 'visible') {
        socketRef.current.connect();
        setIsSleeping(false);
        syncFromRest();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      if (sleepTimer) clearTimeout(sleepTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [session, callState, isSleeping, syncFromRest]);

  // ── Unread Message Tracking ──────────────────────────
  const markAsRead = useCallback(() => {
    if (!session?.roomCode) return;
    localStorage.setItem(`fl_last_read_${session.roomCode}`, String(Date.now()));
    setUnreadCount(0);
  }, [session?.roomCode]);

  useEffect(() => {
    if (!session?.roomCode || messages.length === 0) return;
    const lastRead = Number(localStorage.getItem(`fl_last_read_${session.roomCode}`) || 0);

    if (document.visibilityState === 'visible') {
      markAsRead();
    } else {
      const unread = messages.filter((m) => m.time > lastRead && m.from !== session.userName).length;
      setUnreadCount(unread);
    }
  }, [messages, session?.roomCode, session?.userName, markAsRead]);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('ice-candidate', { candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'failed'].includes(pc.iceConnectionState)) cleanupCall();
    };
    pcRef.current = pc;
    return pc;
  }, [cleanupCall]);

  const getMic = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = s;
    return s;
  };

  const startCall = useCallback(async (isEmergency = false) => {
    try {
      const pc = createPC();
      const stream = await getMic();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setIsEmergencyCall(isEmergency);
      socketRef.current.emit('call-user', { offer, isEmergency });
      setCallState('calling');
    } catch (e) { console.error('Call start error:', e); cleanupCall(); }
  }, [createPC, cleanupCall]);

  const answerCall = useCallback(async () => {
    try {
      const pc = createPC();
      const stream = await getMic();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      while (iceCandidateQueue.current.length > 0) {
        await pc.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.current.shift()));
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('call-answer', { answer });
      setCallState('active');
      setIncomingOffer(null);
    } catch (e) { console.error('Answer error:', e); cleanupCall(); }
  }, [incomingOffer, createPC, cleanupCall]);

  const rejectCall = useCallback(() => {
    socketRef.current?.emit('reject-call');
    cleanupCall();
  }, [cleanupCall]);

  const endCall = useCallback(() => {
    socketRef.current?.emit('end-call');
    cleanupCall();
  }, [cleanupCall]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }, []);

  const sendMessage = useCallback((text, isEmergency = false) => {
    if (socketRef.current && text.trim()) {
      socketRef.current.emit('chat-message', { text: text.trim(), isEmergency });
    }
  }, []);

  const emitTyping = useCallback((isTyping) => {
    if (socketRef.current) {
      socketRef.current.emit(isTyping ? 'typing-start' : 'typing-stop');
    }
  }, []);

  return {
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
    pushPermission: permission,
    requestPushPermission: requestPermissionAndRegister,
  };
}
