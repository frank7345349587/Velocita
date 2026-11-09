// Velocita Automotive PWA Service Worker
const CACHE_NAME = 'velocita-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Continue even if some asset fails to precache
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let external APIs (Overpass, OpenStreetMap tiles, Nominatim) bypass cache or network-first
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    // Network-first for external tiles & APIs
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network first with cache fallback for app assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
