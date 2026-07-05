// Standard native Web Push background notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Received background push:', payload);

    const title = payload.notification?.title || 'New Message on Keryx';
    const options = {
      body: payload.notification?.body || 'Tap to open communication channel.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200, 100, 200, 100, 400],
      requireInteraction: true,
      data: payload.data || {},
      tag: payload.data?.type === 'call' ? 'keryx-call' : 'keryx-msg',
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Error parsing push data:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  event.notification.close();

  // Focus existing window or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if Keryx is already open in a tab
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open the app
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
