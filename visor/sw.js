// ============================================================
//  SERVICE WORKER — Visor "Mis Territorios" PWA
//  Ubicación: /visor/sw.js  |  Scope: /visor/
// ============================================================

const APP_VERSION = 'v1.3.0';
const CACHE = `visor-${APP_VERSION}`;

// Precache the main page with all its URL variants
const PRECACHE = [
  './',
  './index.html',
];

const NETWORK_FIRST = ['iycqizsxmbaboaxveaeb.supabase.co'];
const CACHE_FIRST   = ['unpkg.com','cdn.jsdelivr.net','cdnjs.cloudflare.com',
                        'basemaps.cartocdn.com','server.arcgisonline.com','tile.openstreetmap.org'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('visor-') && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (!['http:','https:'].includes(url.protocol)) return;

  // Always network for Supabase
  if (NETWORK_FIRST.some(o => url.hostname.includes(o))) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Cache-first for CDN assets
  if (CACHE_FIRST.some(o => url.hostname.includes(o))) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // For navigation requests to /visor/ — serve index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Stale-while-revalidate for everything else
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request);
      const net = fetch(e.request).then(res => {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || await net || new Response('', { status: 503 });
    })
  );
});
