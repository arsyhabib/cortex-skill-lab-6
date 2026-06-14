const CACHE_NAME = 'cortex-shell-launch-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './404.html',
  './cortex-app.js',
  './assets/vendor/react.min.js',
  './assets/vendor/react-dom.min.js',
  './assets/vendor/marked.min.js',
  './assets/pwa/cortex-icon.svg',
  './assets/pwa/favicon-32.png',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
  './assets/pwa/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-First for navigation (index.html) to keep code fresh when online
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Stale-While-Revalidate for other static assets/JSON resources
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    const fetchPromise = (async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.status === 200) {
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })();

    return cached || fetchPromise;
  })());
});
