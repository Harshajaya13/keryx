import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

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
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [callState, setCallState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [joinError, setJoinError] = useState(null);

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
      socket.emit('join-room', { roomCode: session.roomCode, userName: session.userName });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setOtherUser(null);
    });

    socket.on('reconnect', () => {
      setConnected(true);
      socket.emit('join-room', { roomCode: session.roomCode, userName: session.userName });
    });

    socket.on('join-error', (msg) => setJoinError(msg));

    socket.on('room-status', ({ users }) => {
      const other = users.find((u) => u.name !== session.userName);
      setOtherUser(other ? other.name : null);
    });

    socket.on('chat-history', (history) => setMessages(history));
    socket.on('chat-message', (msg) => setMessages((prev) => [...prev, msg]));

    // WebRTC
    socket.on('incoming-call', (data) => {
      setCallState('incoming');
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
  }, [session, serverUrl]);

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    iceCandidateQueue.current = [];
    setCallState('idle');
    setIsMuted(false);
    setIncomingOffer(null);
  }, []);

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

  const startCall = useCallback(async () => {
    try {
      const pc = createPC();
      const stream = await getMic();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('call-user', { offer });
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

  const sendMessage = useCallback((text) => {
    if (socketRef.current && text.trim()) socketRef.current.emit('chat-message', { text: text.trim() });
  }, []);

  return { connected, otherUser, messages, sendMessage, callState, startCall, answerCall, rejectCall, endCall, toggleMute, isMuted, joinError };
}
