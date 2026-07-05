import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  const [isConnectingSlow, setIsConnectingSlow] = useState(false);
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

  // Phase 4: Offline Message Queue in localStorage
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fl_offline_queue') || '[]'); } catch { return []; }
  });

  const { permission, fcmToken, pushLoading, pushError, isMockToken, requestPermissionAndRegister } = usePushNotifications(socketRef.current, session);

  useEffect(() => {
    try { localStorage.setItem('fl_offline_queue', JSON.stringify(offlineQueue)); } catch {}
  }, [offlineQueue]);

  const syncFromRest = useCallback(async () => {
    if (!session?.token) return;
    try {
      const headers = { 'Authorization': session.token };
      const [msgRes, callRes] = await Promise.all([
        fetch(`${serverUrl}/api/messages`, { headers }),
        fetch(`${serverUrl}/api/calls`, { headers }),
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
  }, [serverUrl, session?.token]);

  // ── Render Cold Start Warning Timer ──────────────────
  useEffect(() => {
    if (connected || isSleeping) {
      setIsConnectingSlow(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!connected && !isSleeping) setIsConnectingSlow(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [connected, isSleeping]);

  // ── Socket connection ──────────────────────────────
  useEffect(() => {
    if (!session?.token) return;

    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setIsConnectingSlow(false);
      setIsSleeping(false);
      socket.emit('join-room', { token: session.token });
      syncFromRest();
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      setOtherUser(null);
      setPartnerPresence((prev) => prev ? { ...prev, status: 'offline', lastSeen: Date.now() } : null);
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // Automatically attempt reconnection
      }
    });

    socket.on('reconnect', () => {
      setConnected(true);
      setIsConnectingSlow(false);
      setIsSleeping(false);
      socket.emit('join-room', { token: session.token });
      syncFromRest();
    });

    // Phase 4 Friendly Error Wording
    socket.on('join-error', (msg) => {
      const friendlyMsg = msg.includes('expired') ? 'Session expired. Please log in again.' : msg;
      setJoinError(friendlyMsg);
    });

    socket.on('call-error', (msg) => {
      const friendlyMsg = msg.includes('Too many') ? 'Too many call attempts. Please wait one minute.' : msg;
      setCallError(friendlyMsg);
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

      // Trigger reliable OS/system notification for incoming call when tab is in background or minimized
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = data.isEmergency ? '🚨 EMERGENCY VOICE CALL' : '📞 Incoming Voice Call';
        const options = {
          body: `${data.from || 'Partner'} is calling you on Keryx! Tap to answer.`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200, 100, 400],
          tag: 'keryx-call',
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, options);
          }).catch(() => {
            try { new Notification(title, options); } catch (e) {}
          });
        } else {
          try { new Notification(title, options); } catch (e) {}
        }
      }
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
      } catch (e) {
        console.error('Answer error:', e);
        setCallError('Unable to connect the call. Please try again.');
        setTimeout(() => setCallError(null), 5000);
        cleanupCall();
      }
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

  // Phase 4: Clean Resource Release
  const cleanupCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      localStreamRef.current = null;
    }
    iceCandidateQueue.current = [];
    setCallState('idle');
    setIsEmergencyCall(false);
    setIsMuted(false);
    setIncomingOffer(null);
  }, []);

  // ── Phase 4: Automatic Offline Queue Flushing ────────
  useEffect(() => {
    if (connected && offlineQueue.length > 0 && socketRef.current) {
      console.log('🔄 Connection restored! Flushing offline message queue...', offlineQueue.length);
      offlineQueue.forEach((msg) => {
        socketRef.current.emit('chat-message', { text: msg.text, isEmergency: msg.isEmergency === 1 });
      });
      setOfflineQueue([]);
      localStorage.removeItem('fl_offline_queue');
    }
  }, [connected, offlineQueue]);

  // ── Reconnect & Sync on Visibility/Online ────────────
  useEffect(() => {
    if (!session?.token) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [session, isSleeping, syncFromRest]);

  // ── Unread Message Tracking ──────────────────────────
  const markAsRead = useCallback(() => {
    if (!session?.userName) return;
    localStorage.setItem(`fl_last_read_FAMILY`, String(Date.now()));
    setUnreadCount(0);
  }, [session?.userName]);

  useEffect(() => {
    if (!session?.userName || messages.length === 0) return;
    const lastRead = Number(localStorage.getItem(`fl_last_read_FAMILY`) || 0);

    if (document.visibilityState === 'visible') {
      markAsRead();
    } else {
      const unread = messages.filter((m) => m.time > lastRead && m.from !== session.userName).length;
      setUnreadCount(unread);
    }
  }, [messages, session?.userName, markAsRead]);

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
      if (['disconnected', 'failed'].includes(pc.iceConnectionState)) {
        setCallError('Connection lost. Ending call.');
        setTimeout(() => setCallError(null), 5000);
        cleanupCall();
      }
    };
    pcRef.current = pc;
    return pc;
  }, [cleanupCall]);

  const getMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = s;
      return s;
    } catch (err) {
      setCallError('Microphone permission required for voice calls.');
      setTimeout(() => setCallError(null), 5000);
      throw err;
    }
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
    } catch (e) {
      console.error('Call start error:', e);
      setCallError('Unable to start the call. Please check microphone settings.');
      setTimeout(() => setCallError(null), 5000);
      cleanupCall();
    }
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
    } catch (e) {
      console.error('Answer error:', e);
      setCallError('Unable to answer call. Please try again.');
      setTimeout(() => setCallError(null), 5000);
      cleanupCall();
    }
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

  // Phase 4: Send Message with Offline Queue Support
  const sendMessage = useCallback((text, isEmergency = false) => {
    if (!text.trim()) return;
    if (socketRef.current && socketRef.current.connected && navigator.onLine) {
      socketRef.current.emit('chat-message', { text: text.trim(), isEmergency });
    } else {
      console.log('📵 Offline or disconnected. Queueing message locally...');
      const offlineMsg = {
        id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        from: session.userName,
        text: text.trim(),
        time: Date.now(),
        status: 'waiting',
        isEmergency: isEmergency ? 1 : 0,
        isOffline: true,
      };
      setOfflineQueue((prev) => [...prev, offlineMsg]);
    }
  }, [session?.userName]);

  const emitTyping = useCallback((isTyping) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(isTyping ? 'typing-start' : 'typing-stop');
    }
  }, []);

  // Combine server messages with local offline waiting messages
  const combinedMessages = useMemo(() => {
    return [...messages, ...offlineQueue];
  }, [messages, offlineQueue]);

  return {
    connected,
    isConnectingSlow,
    isSleeping,
    otherUser,
    partnerPresence,
    partnerTyping,
    messages: combinedMessages,
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
    fcmToken,
    pushLoading,
    pushError,
    isMockToken,
    requestPushPermission: requestPermissionAndRegister,
  };
}
