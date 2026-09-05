/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

// Injected by vite-plugin-pwa (injectManifest strategy) at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Web Push ---
// The backend sends a JSON payload like:
//   { title, body, tag, data: { kind: 'call'|'message', peer, callType } }
self.addEventListener('push', (event) => {
  let payload = { title: 'CallChat', body: 'You have a new notification.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const { title, ...options } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: options.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: options.tag || 'callchat-notification',
      // Incoming calls should interrupt; chat messages shouldn't nag forever.
      requireInteraction: options.data?.kind === 'call',
      data: options.data || {},
      vibrate: options.data?.kind === 'call' ? [200, 100, 200, 100, 200] : [100],
    })
  );
});

// Clicking the notification focuses an existing tab (so the live WebSocket
// state - the incoming-call modal, the chat thread - is what the user sees)
// or opens a new one if the app isn't open anywhere.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.kind === 'message' && data.peer ? `/chats?peer=${encodeURIComponent(data.peer)}` : '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'notification-click', data });
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* some browsers restrict cross-origin navigate; ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
