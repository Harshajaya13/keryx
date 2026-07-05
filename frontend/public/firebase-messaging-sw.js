// Keryx Service Worker: Maximum-priority background push notification handler
// Designed to break through Samsung Knox battery optimization and Android Doze mode

// Skip waiting so the latest service worker activates immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    // If JSON parse fails, try plain text
    try {
      payload = { data: { title: 'Keryx', body: event.data.text() } };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      return;
    }
  }

  console.log('[SW] Push received:', payload);

  // FCM data-only messages put everything in payload.data
  // FCM notification messages put display info in payload.notification
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || 'Keryx';
  const isCall = data.type === 'call';
  const isEmergency = data.isEmergency === 'true';

  const options = {
    body: notification.body || data.body || 'Tap to open family channel.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data,
    tag: isCall ? 'keryx-call' : 'keryx-msg-' + Date.now(),
    renotify: true, // Always vibrate + sound even if same tag
    requireInteraction: true, // Do NOT auto-dismiss
    silent: false, // Force sound
    vibrate: isCall
      ? [400, 200, 400, 200, 400, 200, 400, 200, 400] // Aggressive call vibration
      : isEmergency
        ? [400, 200, 400, 200, 400] // Emergency vibration
        : [200, 100, 200], // Normal message vibration
    actions: isCall
      ? [
          { action: 'answer', title: '📞 Answer' },
          { action: 'decline', title: '❌ Decline' },
        ]
      : [
          { action: 'open', title: '💬 Open' },
        ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification, 'action:', event.action);
  event.notification.close();

  // Focus existing Keryx window or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing Keryx tab
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // No existing tab found — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle notification close (user dismissed without clicking)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});
