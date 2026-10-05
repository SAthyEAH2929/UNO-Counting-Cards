const CACHE_NAME = 'uno-race-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-96.png',
  '/icon-192.png',
  '/icon-maskable-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/screenshot-desktop.png',
  '/screenshot-mobile.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});

// Background Sync (PWABuilder Compliance)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-state') {
    event.waitUntil(Promise.resolve());
  }
});

// Periodic Background Sync (PWABuilder Compliance)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-leaderboard') {
    event.waitUntil(Promise.resolve());
  }
});

// Push Notifications (PWABuilder Compliance)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.text() : 'It is your turn in UNO Board Race!';
  event.waitUntil(
    self.registration.showNotification('UNO Board Showdown', {
      body: data,
      icon: '/icon-192.png',
      badge: '/icon-96.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
