// Core — offline-first shell.
// Strategy: static assets (app shell, fonts, icons) are cache-first, since
// they change only on deploy. Feed/API data is network-first with a cache
// fallback, so a user reopening the app on a bad connection sees their last
// known feed instead of a blank error screen — never stale votes/reputation
// numbers presented as if they were live.

const SHELL_CACHE = 'core-shell-v1';
const SHELL_ASSETS = ['/', '/manifest.json', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache mutating requests — voting, posting, agent triggers must
  // always hit the network or fail loudly, never silently replay from cache.
  if (request.method !== 'GET') return;

  // API reads: network-first, falling back to the last cached response.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Everything else: cache-first, network fallback.
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).catch(() => caches.match('/offline.html'))));
});
