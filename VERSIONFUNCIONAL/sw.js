// ============================================================
//  SERVICE WORKER — Territorios PWA
//  Estrategia: Cache-first para assets, Network-first para datos
// ============================================================

const APP_VERSION = 'v1.0.2';
const CACHE_STATIC = `territorios-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `territorios-dynamic-${APP_VERSION}`;

const PRECACHE_ASSETS = [
  '/territorios.html',
  '/territorio-visor.html',
  '/zonas.geojson',
  '/manifest.json',
  '/manifest-visor.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
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

// ── INSTALL ──
self.addEventListener('install', event => {
  console.log('[SW] Installing', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache =>
      Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => console.log('[SW] Could not precache:', url))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating', APP_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
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
    event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// ── STRATEGIES ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineResponse(request);
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineResponse(request);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkFetch || offlineResponse(request);
}

function offlineResponse(request) {
  if (request.mode === 'navigate') {
    return new Response(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión</title>
<style>body{font-family:-apple-system,sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;gap:16px;padding:24px;text-align:center}.icon{font-size:56px}h1{font-size:22px;font-weight:700;margin:0}p{font-size:15px;color:rgba(255,255,255,.6);margin:0;max-width:300px;line-height:1.6}button{padding:12px 24px;background:#0a84ff;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px}</style>
</head><body><div class="icon">📡</div><h1>Sin conexión</h1><p>Necesitas conexión para cargar los datos de los territorios.</p><button onclick="location.reload()">Reintentar</button></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('', { status: 503 });
}

self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Territorios', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'territorios',
      data: { url: data.url || '/territorios.html' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/territorios.html'));
});
