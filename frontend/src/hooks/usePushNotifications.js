import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFCMToken, onForegroundMessage } from '../services/firebase';

export function usePushNotifications(socket, session) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [fcmToken, setFcmToken] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [isMockToken, setIsMockToken] = useState(false);
  const hasAttemptedRef = useRef(false);

  const registerTokenWithServer = useCallback(
    (token) => {
      if (socket && session && token) {
        socket.emit('register-fcm-token', { token });
        console.log('📡 Sent FCM token to backend for:', session.userName);
      }
    },
    [socket, session]
  );

  const requestPermissionAndRegister = useCallback(async () => {
    if (typeof Notification === 'undefined') return null;
    hasAttemptedRef.current = true;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        setPushLoading(true);
        setPushError(null);
        const res = await fetchFCMToken();
        setPushLoading(false);

        if (res?.error) {
          setPushError(res.error);
          return null;
        }
        if (res?.token) {
          setFcmToken(res.token);
          setIsMockToken(!!res.isMock);
          registerTokenWithServer(res.token);
          return res.token;
        }
      }
    } catch (err) {
      console.error('Error requesting push permission:', err);
      setPushLoading(false);
      setPushError(err.message || 'Error requesting browser permission');
    }
    return null;
  }, [registerTokenWithServer]);

  // Auto-register if permission is already granted (only once per session)
  useEffect(() => {
    if (permission === 'granted' && socket && session && !fcmToken && !pushLoading && !pushError && !hasAttemptedRef.current) {
      hasAttemptedRef.current = true;
      requestPermissionAndRegister();
    }
  }, [permission, socket, session, fcmToken, pushLoading, pushError, requestPermissionAndRegister]);

  // Listen for foreground notifications and show OS banner if tab is hidden or if it is a call
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('🔔 Foreground message:', payload);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        if (document.visibilityState === 'hidden' || payload.data?.type === 'call') {
          try {
            const title = payload.notification?.title || 'Keryx Alert';
            const options = {
              body: payload.notification?.body || 'Tap to open family channel.',
              icon: '/icons/icon-192.png',
              requireInteraction: true,
            };
            new Notification(title, options);
          } catch (e) {
            console.warn('Could not display Notification:', e);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return { permission, fcmToken, pushLoading, pushError, isMockToken, requestPermissionAndRegister };
}
