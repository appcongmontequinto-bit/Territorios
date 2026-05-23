// ============================================================
//  SERVICE WORKER — Visor "Mis Territorios" PWA
//  Ubicación: /visor/sw.js  |  Scope: /visor/
// ============================================================

const APP_VERSION = 'v1.2.0';
const CACHE_STATIC = `visor-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `visor-dynamic-${APP_VERSION}`;

const PRECACHE_ASSETS = [
  '/visor/',
  '/visor/index.html',
  '../icons-visor/icon-192x192.png',
  '../icons-visor/icon-512x512.png',
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
    caches.open(CACHE_STATIC)
      .then(cache => Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('visor-') && k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (NETWORK_FIRST_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(networkFirst(request)); return;
  }
  if (CACHE_FIRST_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(cacheFirst(request)); return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE_DYNAMIC)).put(req, res.clone());
    return res;
  } catch {
    return await caches.match(req) || new Response('', { status: 503 });
  }
}
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE_DYNAMIC)).put(req, res.clone());
    return res;
  } catch { return new Response('', { status: 503 }); }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || await net || new Response('', { status: 503 });
}
