const admin = require('firebase-admin');
const fs = require('fs');

let isInitialized = false;

function initFirebaseAdmin() {
  try {
    if (admin.apps.length > 0) {
      isInitialized = true;
      return;
    }

    let credential = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const val = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (val.trim().startsWith('{')) {
        credential = admin.credential.cert(JSON.parse(val));
      } else if (fs.existsSync(val)) {
        credential = admin.credential.cert(require(val));
      }
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }

    if (credential) {
      admin.initializeApp({ credential });
      isInitialized = true;
      console.log('✅ Firebase Admin initialized successfully.');
    } else {
      console.warn('⚠️ Firebase Admin credentials not found. FCM notifications will run in mock mode.');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
  }
}

initFirebaseAdmin();

/**
 * Sends an FCM push notification to a specific device token.
 * Falls back to mock logging if Firebase Admin is not initialized.
 */
async function sendPushNotification(fcmToken, { title, body, data = {} }) {
  if (!fcmToken) {
    return { success: false, error: 'No FCM token provided' };
  }

  // Convert all data values to strings as FCM requires string key-value pairs
  const stringifiedData = {};
  for (const [key, val] of Object.entries(data)) {
    stringifiedData[key] = String(val);
  }

  if (!isInitialized) {
    console.log(`[FCM Mock Push] To token (${fcmToken.slice(0, 15)}...): "${title}" - "${body}"`, stringifiedData);
    return { success: true, mock: true };
  }

  try {
    const message = {
      token: fcmToken,
      // Data-only message: bypasses Android notification grouping and goes straight to service worker
      data: {
        ...stringifiedData,
        title: title,
        body: body,
      },
      android: {
        priority: 'high',
        ttl: 0, // Deliver immediately, do not batch
        directBootOk: true, // Deliver even if phone has not been unlocked since reboot
        notification: {
          title,
          body,
          sound: 'default',
          channelId: 'keryx-emergency',
          priority: 'max',
          visibility: 'public', // Show full content on lock screen
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationCount: 1,
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '0',
          Topic: stringifiedData.type === 'call' ? 'keryx-call' : 'keryx-msg',
        },
        notification: {
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200, 100, 400],
          renotify: true,
          tag: stringifiedData.type === 'call' ? 'keryx-call' : 'keryx-msg-' + Date.now(),
        },
        fcmOptions: {
          link: '/',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM Notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  isInitialized: () => isInitialized,
};
