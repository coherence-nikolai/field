// Network-first — always fetch live, no stale cache ever
const CACHE = 'field-v3f';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Nuke ALL caches unconditionally
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Always network — never cache
  e.respondWith(fetch(e.request));
});
