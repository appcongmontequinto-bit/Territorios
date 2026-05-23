// SERVICE WORKER — Visor Montequinto
// Ubicación: /Territorios/visor/sw.js
// Scope: /Territorios/visor/
const CACHE = 'visor-v2.0';

self.addEventListener('install', e => {
  // Don't precache - just activate immediately
  // Pages load fine from network, cache builds up naturally
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase API — always network, no cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status:503})));
    return;
  }

  // CDN resources — cache first
  const cdns = ['unpkg.com','cdn.jsdelivr.net','cdnjs.cloudflare.com',
                 'cartocdn.com','arcgisonline.com','openstreetmap.org'];
  if (cdns.some(d => url.hostname.includes(d))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request)
        .then(cached => cached || new Response('Sin conexión', {status:503}))
      )
  );
});
