import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let messaging = null;

export async function initFirebase() {
  if (app) return messaging;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('⚠️ Firebase frontend config missing. Push notifications will run in local fallback mode.');
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('⚠️ Firebase messaging is not supported in this browser.');
      return null;
    }
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    console.log('✅ Firebase JS SDK initialized.');
    return messaging;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase JS SDK:', error);
    return null;
  }
}

export async function fetchFCMToken() {
  const msg = await initFirebase();
  if (!msg) {
    // Return a mock token for testing if Firebase isn't configured
    const mockToken = `mock-token-${Math.random().toString(36).substring(2, 10)}`;
    console.log('Using fallback mock FCM token:', mockToken);
    return mockToken;
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  try {
    // Ensure service worker is registered for push notifications
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: swRegistration || undefined,
    });
    return token;
  } catch (error) {
    console.error('❌ Error retrieving FCM token:', error);
    return null;
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('📥 Foreground push notification received:', payload);
    callback(payload);
  });
}
