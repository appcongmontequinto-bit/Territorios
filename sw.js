// ============================================================
//  SERVICE WORKER — Territorios PWA
//  scope: /territorios.html
// ============================================================

const APP_VERSION = 'v1.2.0';
const CACHE_STATIC = `territorios-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `territorios-dynamic-${APP_VERSION}`;

const PRECACHE_ASSETS = [
  '/territorios.html',
  '/zonas.geojson',
  '/manifest.json',
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

self.addEventListener('install', event => {
  console.log('[SW-Territorios] Installing', APP_VERSION);
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

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('territorios-') && k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
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
  return cached || await networkFetch || offlineResponse(request);
}

function offlineResponse(request) {
  if (request.mode === 'navigate') {
    return new Response(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Sin conexión</title>
<style>body{font-family:-apple-system,sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;gap:16px;padding:24px;text-align:center}h1{font-size:22px}p{color:rgba(255,255,255,.6);max-width:300px;line-height:1.6}button{padding:12px 24px;background:#0a84ff;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer}</style>
</head><body><div style="font-size:56px">📡</div><h1>Sin conexión</h1><p>Necesitas conexión para cargar los datos.</p><button onclick="location.reload()">Reintentar</button></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('', { status: 503 });
}

// ══ PUSH NOTIFICATIONS ══
// Receives push from Supabase Edge Function when a new solicitud arrives.
// Updates the app icon badge AND shows a notification, even if the app is closed.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  const title = data.title || 'Territorios Montequinto';
  const body  = data.body  || 'Tienes una nueva solicitud de territorio';
  const badgeCount = data.badge || 1;
  const url = data.url || '/territorios.html';

  event.waitUntil((async () => {
    // Update app icon badge — works even with app closed
    try {
      if ('setAppBadge' in self) {
        await self.setAppBadge(badgeCount);
      } else if ('setAppBadge' in navigator) {
        await navigator.setAppBadge(badgeCount);
      }
    } catch(e) { console.warn('Badge error:', e); }

    // Show system notification
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'solicitud-territorio',
      data: { url },
      vibrate: [200, 100, 200]
    });
  })());
});

// Clicking the notification opens/focuses the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/territorios.html';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.includes('territorios.html')) {
        client.focus();
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
