const CACHE = 'classkit-static-v12';
const FILES = ['./', 'index.html', 'styles.css', 'src/app.js', 'src/core.js', 'src/store.js', 'data/words.json', 'data/config.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(file => new URL(file, self.registration.scope).href));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('classkit-static-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (event.request.mode === 'navigate') return caches.match(new URL('index.html', self.registration.scope).href);
      throw new Error('Offline and resource is not cached');
    }
  })());
});
