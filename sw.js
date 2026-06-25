/* ============================================================
   Tennis Log — Service Worker (Network First)
   Cache name: increment version to force update on all clients
============================================================ */
const CACHE_NAME = 'tennis-log-rg-v1';
const PRECACHE   = [
  '/tennis-log/',
  '/tennis-log/index.html',
];

/* ── INSTALL: pre-cache the shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

/* ── ACTIVATE: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of all tabs immediately
  );
});

/* ── FETCH: Network First strategy ──
   Always try the network first so the user always gets the latest version.
   If the network fails (offline), fall back to cache.
   Third-party requests (Firebase, CDN) go straight through without caching.
*/
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests for our own origin
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache a clone of successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ── MESSAGE: allow the app to trigger skipWaiting ──
   Used by the "Actualizar" button in the update banner.
*/
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
