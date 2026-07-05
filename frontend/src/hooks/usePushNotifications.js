import { useState, useEffect, useCallback } from 'react';
import { fetchFCMToken, onForegroundMessage } from '../services/firebase';

export function usePushNotifications(socket, session) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [fcmToken, setFcmToken] = useState(null);

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

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const token = await fetchFCMToken();
        if (token) {
          setFcmToken(token);
          registerTokenWithServer(token);
          return token;
        }
      }
    } catch (err) {
      console.error('Error requesting push permission:', err);
    }
    return null;
  }, [registerTokenWithServer]);

  // Auto-register if permission is already granted
  useEffect(() => {
    if (permission === 'granted' && socket && session) {
      requestPermissionAndRegister();
    }
  }, [permission, socket, session, requestPermissionAndRegister]);

  // Listen for foreground notifications
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('🔔 Foreground message:', payload);
      // If needed, custom foreground alerts can be handled here
    });
    return () => unsubscribe();
  }, []);

  return { permission, fcmToken, requestPermissionAndRegister };
}
