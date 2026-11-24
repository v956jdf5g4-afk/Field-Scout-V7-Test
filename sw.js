/* Field Scout 7.4.0 development build. Cache entries belong to this installation path. */
const PREFIX = 'field-scout:' + self.registration.scope + ':';
const CACHE = PREFIX + '7.4.0-rc1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './field-plan.js?v=7.4.0-rc1', './farmer-notes.js?v=7.4.0-rc1', './fertilizer-blend.js?v=7.4.0-rc1', './fertility-recommendations.js?v=7.4.0-rc1', './fertility-ui.js?v=7.4.0-rc1'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return await cache.match(request) || await cache.match('./index.html') || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone()).catch(() => {});
    return response;
  })());
});
