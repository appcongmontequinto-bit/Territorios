// ============================================================
//  SERVICE WORKER — Visor "Mis Territorios" PWA  
//  scope: /territorio-visor.html
// ============================================================

const APP_VERSION = 'v1.1.0';
const CACHE_STATIC = `visor-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `visor-dynamic-${APP_VERSION}`;

const PRECACHE_ASSETS = [
  '/territorio-visor.html',
  '/manifest-visor.json',
  '/icons-visor/icon-192x192.png',
  '/icons-visor/icon-512x512.png',
];

const NETWORK_FIRST_ORIGINS = [
  'iycqizsxmbaboaxveaeb.supabase.co',
];

const CACHE_FIRST_ORIGINS = [
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'basemaps.cartocdn.com',
  'server.arcgisonline.com',
  'tile.openstreetmap.org',
];

self.addEventListener('install', event => {
  console.log('[SW-Visor] Installing', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache =>
      Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => console.log('[SW-Visor] Could not precache:', url))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('visor-') && k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (NETWORK_FIRST_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (CACHE_FIRST_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return await caches.match(request) || new Response('', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkFetch || new Response('', { status: 503 });
}
